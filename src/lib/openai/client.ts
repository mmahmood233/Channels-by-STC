import OpenAI from "openai";

// Server-side only — never import this in client components
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
