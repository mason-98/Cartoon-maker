import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      return NextResponse.json({ success: true, profile: existingProfile });
    }

    // Create new profile
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        credits: 3,
        tier: 'free'
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create profile:", insertError);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: newProfile });

  } catch (error) {
    console.error("Profile creation error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
} 