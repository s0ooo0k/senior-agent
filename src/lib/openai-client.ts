import OpenAI from "openai";

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getOpenAIEmbeddingClient() {
  const apiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY2 or OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}
