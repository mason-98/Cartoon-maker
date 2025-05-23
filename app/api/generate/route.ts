import { NextResponse } from "next/server";
import { generateWithRateLimit } from "@/lib/gemini";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * API route for generating emoji-style images using Gemini AI model.
 */
export async function POST(req: Request) {
  try {
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
    console.log("API: Image data starts with:", imageData.substring(0, 50) + "...");

    if (!imageData) {
      throw new Error('Failed to generate a valid Cartoon. Please try again.');
    }

    const response = { 
      cartoons: [imageData],
      description: prompt 
    };
    console.log("API: Sending response with image data");

    return NextResponse.json(response);

  } catch (error) {
    console.error("API: Error generating Cartoon:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : "Failed to generate Cartoon. Please try again with a different prompt."
      },
      { status: 500 }
    );
  }
}
