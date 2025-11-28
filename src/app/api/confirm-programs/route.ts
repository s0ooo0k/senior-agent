import { NextRequest, NextResponse } from 'next/server';
import type { ProgramItem } from '@/types/domain';
import { createUpstageEmbedding } from '@/lib/openai-client';
import { ensureCollection, COLLECTION_NAME } from '@/lib/qdrant-client';

// 문자열 ID를 숫자 ID로 변환
function generateNumericId(stringId: string): number {
  let hash = 0;
  for (let i = 0; i < stringId.length; i++) {
    const char = stringId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export async function POST(request: NextRequest) {
  try {
    const { programs } = (await request.json()) as {
      programs: ProgramItem[];
    };

    if (!programs || programs.length === 0) {
      return NextResponse.json(
        { error: 'No programs provided' },
        { status: 400 }
      );
    }

    const upstageApiKey = process.env.UPSTAGE_API_KEY;
    if (!upstageApiKey) {
      return NextResponse.json(
        { error: 'Upstage API key not configured' },
        { status: 500 }
      );
    }

    // Qdrant 초기화
    const qdrant = await ensureCollection();
    const embeddingResults = [];

    for (const program of programs) {
      try {
        // Solar LLM으로 자연어 문장 생성
        const textContent = await generateProgramText(program, upstageApiKey);

        // Upstage Solar Embedding 생성 (passage 모드)
        const embedding = await createUpstageEmbedding(textContent, 'passage');

        // Qdrant에 저장
        const pointId = generateNumericId(program.id);
        await qdrant.upsert(COLLECTION_NAME, {
          wait: true,
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                ...program,
                original_id: program.id,
                text_content: textContent,
              },
            },
          ],
        });

        embeddingResults.push({
          id: program.id,
          title: program.title,
          status: 'success',
        });
      } catch (error) {
        console.error(`Failed to embed program ${program.id}:`, error);
        embeddingResults.push({
          id: program.id,
          title: program.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = embeddingResults.filter((r) => r.status === 'success').length;

    return NextResponse.json({
      message: `${successCount}개 프로그램이 Qdrant에 저장되었습니다!`,
      total: programs.length,
      success: successCount,
      failed: programs.length - successCount,
      results: embeddingResults,
    });
  } catch (error) {
    console.error('Error confirming programs:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function generateProgramText(
  program: ProgramItem,
  upstageApiKey?: string
): Promise<string> {
  // 구조화된 데이터 준비
  const structuredInfo: Record<string, string> = {
    제목: program.title,
    유형:
      program.type === 'job'
        ? '일자리'
        : program.type === 'policy'
        ? '정책'
        : '교육',
    지역: program.region,
  };

  if (program.description) structuredInfo.설명 = program.description;
  if (program.target_age) structuredInfo.대상연령 = program.target_age;
  if (program.benefits) structuredInfo.혜택 = program.benefits;
  if (program.requirements) structuredInfo.요건 = program.requirements;
  if (program.duration) structuredInfo.기간 = program.duration;
  if (program.cost) structuredInfo.비용 = program.cost;
  if (program.provider) structuredInfo.제공기관 = program.provider;
  if (program.tags && program.tags.length > 0)
    structuredInfo.태그 = program.tags.join(', ');

  // Solar LLM이 없거나 실패하면 fallback
  if (!upstageApiKey) {
    return Object.entries(structuredInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  try {
    // Solar LLM으로 자연어 문장 생성
    const response = await fetch(
      'https://api.upstage.ai/v1/solar/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'solar-pro',
          messages: [
            {
              role: 'system',
              content: `당신은 프로그램 정보를 자연스러운 문장으로 변환하는 전문가입니다.
주어진 구조화된 정보를 읽기 쉬운 2-4개의 자연스러운 문장으로 작성하세요.
모든 정보를 빠짐없이 포함하되, 자연스럽게 연결하세요.`,
            },
            {
              role: 'user',
              content: `다음 정보를 자연스러운 문장으로 변환해주세요:\n\n${Object.entries(
                structuredInfo
              )
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n')}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Solar API failed');
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || '';

    return (
      generatedText.trim() ||
      Object.entries(structuredInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    );
  } catch (error) {
    console.warn('Solar text generation failed, using fallback:', error);
    // Fallback: 구조화된 형식
    return Object.entries(structuredInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
}
