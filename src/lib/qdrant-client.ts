import { QdrantClient } from '@qdrant/js-client-rest';

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient() {
  if (!qdrantClient) {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = process.env.QDRANT_API_KEY;

    qdrantClient = new QdrantClient({
      url,
      apiKey,
    });
  }

  return qdrantClient;
}

export const COLLECTION_NAME = 'busg_programs';

export async function ensureCollection() {
  const client = getQdrantClient();

  try {
    // 컬렉션이 존재하는지 확인
    await client.getCollection(COLLECTION_NAME);
  } catch (error) {
    // 컬렉션이 없으면 생성
    console.log(`Creating collection: ${COLLECTION_NAME}`);
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 4096, // solar-embedding-1-large 차원
        distance: 'Cosine',
      },
    });
  }

  return client;
}
