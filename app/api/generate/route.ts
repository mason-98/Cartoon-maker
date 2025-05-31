import { NextResponse } from "next/server";
import { generateWithRateLimit } from "@/lib/gemini";
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Create Supabase client (we'll recreate it with admin rights)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getOrCreateUserProfile(userId: string) {
  console.log("Checking profile for user:", userId);
  
  // Check if user exists
  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select()
    .eq('user_id', userId)
    .single();

  console.log("Profile fetch result:", { profile, fetchError });

  if (fetchError && fetchError.code === 'PGRST116') {
    console.log("Profile not found, creating new profile");
    // User doesn't exist, create new profile
    const { data, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        credits: 3,
        tier: 'free'
      })
      .select()
      .single();

    console.log("Profile creation result:", { data, insertError });

    if (insertError) {
      console.error("Failed to create profile:", insertError);
      throw new Error('Failed to create user profile');
    }
    return data;
  } else if (fetchError) {
    console.error("Error fetching profile:", fetchError);
    throw new Error('Failed to fetch user profile');
  }

  return profile;
}

async function uploadFile(userId: string, file: Blob | string, prompt: string) {
  try {
    // Get or create user profile using admin client
    const profile = await getOrCreateUserProfile(userId);
    console.log("Retrieved profile:", profile);

    if (!profile) {
      throw new Error('Failed to get or create profile');
    }

    if (profile.credits <= 0 && profile.tier === 'free') {
      throw new Error('No credits remaining');
    }

    // Convert base64 string to Blob
    const base64Data = file.toString().split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binaryData], { type: 'image/png' });

    // Generate unique filename to avoid conflicts
    const filename = `${prompt}-${Date.now()}.png`;
    
    // Upload to storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('cartoons')
      .upload(filename, blob);
    
    if (!uploadData || uploadError) {
      throw new Error('Failed to upload image');
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('cartoons')
      .getPublicUrl(filename);

    // Insert record into cartoons table
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('cartoons')
      .insert({
        prompt: prompt,
        image_url: publicUrl,
        likes_count: 0,
        creator_user_id: userId
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('Failed to save cartoon data');
    }

    // Decrement credits for free tier users
    if (profile.tier === 'free') {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update credits:', updateError);
      }
    }

    return { publicUrl, cartoonData: insertData };
  } catch (error) {
    console.error('Upload process error:', error);
    throw error;
  }
}

/**
 * API route for generating cartoon-style images using Gemini AI model.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { prompt } = await req.json();
    console.log("API: Received prompt:", prompt);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("API: Calling Gemini API...");
    const imageData = await generateWithRateLimit(prompt);
    console.log("API: Image data length:", imageData.length);

    if (!imageData) {
      throw new Error('Failed to generate a valid Cartoon. Please try again.');
    }

    const { publicUrl, cartoonData } = await uploadFile(userId, imageData, prompt);

    return NextResponse.json({
      cartoons: [imageData],
      description: prompt,
      url: publicUrl,
      cartoonData
    });

  } catch (error: unknown) {
    console.error("API: Error:", error);
    let errorMessage = "";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : "Failed to process request"
      },
      { status: errorMessage === 'No credits remaining' ? 402 : 500 }
    );
  }
}
