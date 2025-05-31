import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { imageURL } = await req.json();
    console.log("Processing Delete action:", { imageURL, userId });
    
    if (!imageURL) {
      return NextResponse.json({ error: "Cartoon ID is required" }, { status: 400 });
    }

    // Find cartoon by ID
    const { data: cartoon, error: cartoonError } = await supabaseAdmin
      .from('cartoons')
      .select('*')
      .eq('image_url', imageURL)
      .single();

    if (cartoonError || !cartoon) {
      console.error("Failed to fetch cartoon:", cartoonError);
      return NextResponse.json({ error: "Cartoon not found" }, { status: 404 });
    }

    // Check if user is the creator of the cartoon
    if (cartoon.creator_user_id !== userId) {
      return NextResponse.json({ error: "You are not the creator of this cartoon" }, { status: 403 });
    }

    // Delete the cartoon
    const { error: deleteError } = await supabaseAdmin
      .from('cartoons')
      .delete()
      .eq('cartoon_id', cartoon.cartoon_id);

    if (deleteError) {
      console.error("Failed to delete cartoon:", deleteError);
      return NextResponse.json({ error: "Failed to delete cartoon" }, { status: 500 });
    }

    // Delete the likes associated with the cartoon
    const { error: deleteLikesError } = await supabaseAdmin
      .from('likes')
      .delete()
      .eq('cartoon_id', cartoon.cartoon_id);

    if (deleteLikesError) {
      console.error("Failed to delete likes:", deleteLikesError);
      return NextResponse.json({ error: "Failed to delete likes" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      cartoon_delete: cartoon.cartoon_id
    });

  } catch (error) {
    console.error("Delete operation error:", error);
    return NextResponse.json(
      { error: "Failed to process delete operation" },
      { status: 500 }
    );
  }
} 