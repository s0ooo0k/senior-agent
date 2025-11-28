import { NextResponse } from 'next/server';
import { getOpenAIEmbeddingClient } from '@/lib/openai-client';
import { ensureCollection, COLLECTION_NAME } from '@/lib/qdrant-client';
import type { JobItem, PolicyItem, EducationItem, ProgramItem } from '@/types/domain';

import jobsData from '@/data/jobs.json';
import policiesData from '@/data/policies.json';
import educationsData from '@/data/educations.json';

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

export async function POST() {
  try {
    // OpenAI 임베딩 클라이언트 및 Qdrant 초기화
    const openai = getOpenAIEmbeddingClient();
    const qdrant = await ensureCollection();

    const embeddingModel =
      process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

    const jobs = jobsData as JobItem[];
    const policies = policiesData as PolicyItem[];
    const educations = educationsData as EducationItem[];

    // 모든 데이터를 ProgramItem 형식으로 변환
    const allPrograms: ProgramItem[] = [
      ...jobs.map(jobToProgram),
      ...policies.map(policyToProgram),
      ...educations.map(educationToProgram),
    ];

    console.log(`총 ${allPrograms.length}개 프로그램 임베딩 시작...`);

    // 임베딩 및 저장
    const results = [];
    const upstageApiKey = process.env.UPSTAGE_API_KEY;

    for (let i = 0; i < allPrograms.length; i++) {
      const program = allPrograms[i];
      try {
        // Solar LLM으로 자연어 문장 생성
        const textContent = await generateProgramText(program, upstageApiKey);

        // OpenAI 임베딩 생성
        const embeddingResponse = await openai.embeddings.create({
          model: embeddingModel,
          input: textContent,
        });

        const embedding = embeddingResponse.data[0].embedding;

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
          type: program.type,
          status: 'success',
        });
      } catch (error) {
        console.error(`Failed to embed program ${program.id}:`, error);
        results.push({
          id: program.id,
          title: program.title,
          type: program.type,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      message: `${successCount}개 프로그램 임베딩 완료 (실패: ${failedCount})`,
      total: allPrograms.length,
      success: successCount,
      failed: failedCount,
      breakdown: {
        jobs: jobs.length,
        policies: policies.length,
        educations: educations.length,
      },
      results,
    });
  } catch (error) {
    console.error('Error embedding static data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function jobToProgram(job: JobItem): ProgramItem {
  return {
    id: job.id,
    title: job.title,
    type: 'job',
    region: job.region,
    description: job.description,
    benefits: `급여: ${job.min_salary.toLocaleString()}~${job.max_salary.toLocaleString()}원`,
    requirements: `활동량: ${job.activity_level}, 자세: ${job.posture}, 디지털: ${job.requires_digital ? '필요' : '불필요'}`,
    duration: `주 ${job.work_days}일`,
    deadline: job.deadline,
    tags: job.tags,
  };
}

function policyToProgram(policy: PolicyItem): ProgramItem {
  return {
    id: policy.id,
    title: policy.title,
    type: 'policy',
    region: policy.region,
    target_age: policy.target_age,
    description: policy.description,
    benefits: policy.benefit,
    deadline: policy.deadline,
    link: policy.link,
    tags: policy.tags,
  };
}

function educationToProgram(education: EducationItem): ProgramItem {
  return {
    id: education.id,
    title: education.title,
    type: 'education',
    region: education.region,
    description: education.summary,
    requirements: `디지털: ${education.requires_digital ? '필요' : '불필요'}`,
    duration: education.duration,
    cost: education.cost,
    start_date: education.start_date,
    tags: education.tags,
    provider: education.provider,
  };
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
