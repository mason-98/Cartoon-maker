import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY environment variable");
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateWithRateLimit(prompt: string) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${MAX_RETRIES}`);
      
      // Enhance the prompt to specifically request cartoon-style images
      const enhancedPrompt = `Create a fun cartoon illustration of: "${prompt}"

Style requirements:
1. Modern cartoon style with clean, bold lines
2. Vibrant and playful colors
3. Expressive character design
4. Simple, clean background
5. Suitable for all ages
6. Cute and appealing aesthetic
7. Well-balanced composition
8. Clear focal point
9. Smooth shading and highlights`;

      console.log("Sending request to Gemini API...");
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        throw new Error('No content parts in response');
      }

      // Find the image part in the response
      const imagePart = parts.find(
        part => part.inlineData?.mimeType?.startsWith('image/')
      );

      if (!imagePart?.inlineData?.data) {
        throw new Error('No image was generated');
      }

      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to generate image after multiple attempts');
}