# Project Overview
Use this guide to build a wem app where users can give a text prompt to generate cartoon's using a model hosted on Gemini

# Feature Requirements
- We will use Next.js, Shadcn, Lucid, Supabase, Clerk
- Create a form where users can put in a prompt, and clicking on a button that calls the Gemini model to generate an cartoon
- Have a nice UI & animation when the cartoon is blank or generating
- Display all the images ever generated in a grid
- When hovering over each cartoon image, an icon button for download, and an icon button for like should show up

# Relevant docs
## How to use gemini cartoon generator model
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-001",
  tools: [
    {
      codeExecution: {},
    },
  ],
});


/**
 * API route for generating content using Gemini AI model.
 */
export async function POST(req: Request): Promise<Response> {
  /**
   * Get the prompt from the request body.
   */
  const data = await req.json();
  const prompt = data.text || "Explain how AI works";

  /**
   * Use the Gemini AI model to generate content from the prompt.
   */
  const result = await model.generateContent(prompt);

  /**
   * Return the generated content as a JSON response.
   */
  return new Response(
    JSON.stringify({
      summary: result.response.text(),
    }),
  );
}


# Current File structure
EMOJI-MAKER
├── .next
├── app
│   ├── fonts
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
├── components
│   └── ui
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── gemini-ai-app
├── lib
├── node_modules
├── public
├── requirements
│   └── frontend_instructions.md
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
└── tsconfig.json

# Rules
- All new components should go in /components and be named like example-component.tsx unless otherwise specified
- All new pages go in /app