import { NextRequest, NextResponse } from 'next/server';
import { createUpstageEmbedding } from '@/lib/openai-client';
import { ensureCollection, COLLECTION_NAME } from '@/lib/qdrant-client';
import type { ProgramItem } from '@/types/domain';

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

    // Qdrant 초기화
    const qdrant = await ensureCollection();

    // 각 프로그램을 임베딩
    const results = [];
    const upstageApiKey = process.env.UPSTAGE_API_KEY;

    for (const program of programs) {
      try {
        // Solar LLM으로 자연어 문장 생성
        const textContent = await generateProgramText(program, upstageApiKey);

        // Upstage Solar Embedding 생성 (passage 모드)
        const embedding = await createUpstageEmbedding(textContent, 'passage');

        // Qdrant는 UUID나 정수 ID만 허용하므로 해시 생성
        const pointId = generateNumericId(program.id);

        // Qdrant에 저장
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

        results.push({
          id: program.id,
          title: program.title,
          status: 'success',
        });
      } catch (error) {
        console.error(`Failed to embed program ${program.id}:`, error);
        results.push({
          id: program.id,
          title: program.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      message: `${successCount}개 프로그램 임베딩 완료 (실패: ${failedCount})`,
      total: programs.length,
      success: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error('Error embedding programs:', error);
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
    유형: program.type === 'job' ? '일자리' : program.type === 'policy' ? '정책' : '교육',
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
              content: `다음 정보를 자연스러운 문장으로 변환해주세요:\n\n${Object.entries(structuredInfo)
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

    return generatedText.trim() || Object.entries(structuredInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  } catch (error) {
    console.warn('Solar text generation failed, using fallback:', error);
    // Fallback: 구조화된 형식
    return Object.entries(structuredInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
}
