import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { imageURL, status } = await req.json();
    console.log("Processing like action:", { imageURL, status, userId });
    
    if (!imageURL) {
      return NextResponse.json({ error: "Cartoon ID is required" }, { status: 400 });
    }

    if (typeof status !== 'number' || ![0, 1].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    // Find cartoon by ID
    const { data: cartoon, error: cartoonError } = await supabaseAdmin
      .from('cartoons')
      .select('*')
      .eq('image_url', imageURL)
      .single();

    console.log("Cartoon fetch result:", { cartoon, cartoonError });

    if (cartoonError || !cartoon) {
      console.error("Failed to fetch cartoon:", cartoonError);
      return NextResponse.json({ error: "Cartoon not found" }, { status: 404 });
    }

    // Check if user has already liked
    const { data: existingLike, error: likeCheckError } = await supabaseAdmin
      .from('likes')
      .select('*')
      .eq('cartoon_id', cartoon.cartoon_id)
      .eq('liked_by', userId)
      .single();

    
    console.log("Existing like check:", { existingLike, likeCheckError });

    const isLiking = !existingLike || existingLike.status === 0;
    const newLikeCount = isLiking ? (cartoon.likes_count + 1) : Math.max(0, cartoon.likes_count - 1);

    console.log("Existing like:", { existingLike });
    console.log("New like count:", { newLikeCount });
    console.log("Is liking:", { isLiking });

    // Update or insert like status
    if (!existingLike) {
      const { error: likeError } = await supabaseAdmin
      .from('likes')
      .insert({
        cartoon_id: cartoon.cartoon_id,
        liked_by: userId,
        status: +isLiking,
        creator_user_id: cartoon.creator_user_id
      });
      if (likeError) {
        console.error("Like error:", likeError);
        return NextResponse.json({ error: "Failed to update like status" }, { status: 500 });
      }
    } else {
      const { error: likeError } = await supabaseAdmin
      .from('likes')
      .update({
        status: +isLiking})
      .eq('like_id',existingLike.like_id);
      if (likeError) {
        console.error("Like error:", likeError);
        return NextResponse.json({ error: "Failed to update like status" }, { status: 500 });
      }
    }

    console.log("Cartoon likes count:", { cartoon });

    // Update cartoon likes count
    const { error: updateError } = await supabaseAdmin
      .from('cartoons')
      .update({ likes_count: Number(newLikeCount) })
      .eq('cartoon_id', cartoon.cartoon_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to update like count" }, { status: 500 });
    }

    console.log("Like operation successful:", { newLikeCount, status });

    return NextResponse.json({ 
      success: true, 
      likes_count: newLikeCount,
      action: isLiking ? 'liked' : 'unliked'
    });

  } catch (error) {
    console.error("Like operation error:", error);
    return NextResponse.json(
      { error: "Failed to process like operation" },
      { status: 500 }
    );
  }
} 