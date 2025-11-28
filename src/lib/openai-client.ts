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

// Upstage Solar Embedding 함수
export async function createUpstageEmbedding(
  text: string,
  modelType: 'query' | 'passage' = 'passage'
): Promise<number[]> {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY is not set");
  }

  const model =
    modelType === 'query'
      ? 'solar-embedding-1-large-query'
      : 'solar-embedding-1-large-passage';

  const response = await fetch('https://api.upstage.ai/v1/solar/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upstage Embedding API error: ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;

  if (!Array.isArray(embedding)) {
    throw new Error('Embedding is not an array');
  }

  if (embedding.length !== 4096) {
    throw new Error(`Embedding dimension mismatch: expected 4096, got ${embedding.length}`);
  }

  return embedding;
}
