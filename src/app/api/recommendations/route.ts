import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIEmbeddingClient } from "@/lib/openai-client";
import { getQdrantClient, COLLECTION_NAME } from "@/lib/qdrant-client";
import {
  filterEducations,
  filterJobs,
  filterPolicies,
} from "@/lib/matching";
import {
  buildRerankUserPrompt,
  rerankSystemPrompt,
} from "@/lib/prompts";
import type {
  EducationItem,
  JobItem,
  PolicyItem,
  ProgramItem,
  SeniorProfile,
} from "@/types/domain";

import jobsData from "@/data/jobs.json";
import policiesData from "@/data/policies.json";
import educationsData from "@/data/educations.json";

export const runtime = "nodejs";

type JobRecommendation = {
  job: JobItem;
  score: number;
  reason: string;
};

type ProgramRecommendation = {
  program: ProgramItem;
  score: number;
  reason: string;
};

function generateProfileQuery(profile: SeniorProfile): string {
  const parts: string[] = [];

  parts.push(`지역: ${profile.region || '부산'}`);
  parts.push(`이전 직업: ${profile.previous_job}`);
  parts.push(`스킬: ${profile.skills?.join(', ')}`);
  parts.push(`활동량: ${profile.activity_level}`);
  parts.push(`근무 자세: ${profile.work_posture}`);
  parts.push(`희망 근무일: 주 ${profile.weekly_work_days}일`);
  parts.push(`희망 급여: ${profile.salary_expectation}`);
  parts.push(`사회적 선호: ${profile.social_preference}`);
  parts.push(`학습 선호: ${profile.learning_preference}`);
  parts.push(`디지털 능력: ${profile.digital_literacy}`);
  parts.push(`동기: ${profile.motivation}`);

  return parts.join('\n');
}

export async function POST(req: Request) {
  try {
    const { profile, topK = 3, useRAG = true } = (await req.json()) as {
      profile: SeniorProfile;
      topK?: number;
      useRAG?: boolean;
    };

    if (!profile) {
      return NextResponse.json(
        { error: "profile 필드가 필요합니다." },
        { status: 400 },
      );
    }

    const client = getOpenAIClient();
    const embeddingClient = getOpenAIEmbeddingClient();
    let programRecommendations: ProgramRecommendation[] = [];

    // RAG 기반 추천 (Qdrant 벡터 검색)
    if (useRAG) {
      try {
        const qdrant = getQdrantClient();
        const embeddingModel =
          process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

        // 프로필을 쿼리 텍스트로 변환 및 임베딩
        const queryText = generateProfileQuery(profile);
        const embeddingResponse = await embeddingClient.embeddings.create({
          model: embeddingModel,
          input: queryText,
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Qdrant에서 벡터 검색
        const searchResults = await qdrant.search(COLLECTION_NAME, {
          vector: queryEmbedding,
          limit: 15,
          with_payload: true,
        });

        if (searchResults.length > 0) {
          // 검색 결과를 프로그램으로 변환
          const programs = searchResults
            .map((result) => ({
              program: result.payload as unknown as ProgramItem,
              score: result.score,
            }))
            .filter((p) => p.program && p.program.id);

          // LLM으로 리랭킹
          const programTexts = programs
            .map(
              (p, idx) =>
                `[${idx + 1}] ID: ${p.program.id}
제목: ${p.program.title}
유형: ${p.program.type}
지역: ${p.program.region}
설명: ${p.program.description || ''}
혜택: ${p.program.benefits || ''}
요건: ${p.program.requirements || ''}
태그: ${p.program.tags?.join(', ') || ''}
초기 점수: ${p.score.toFixed(3)}`,
            )
            .join('\n\n');

          const rerankCompletion = await client.chat.completions.create({
            model: process.env.OPENAI_LLM_MODEL ?? 'gpt-5',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `당신은 시니어에게 맞는 프로그램(일자리, 정책, 교육)을 추천하는 전문가입니다.
프로필과 후보 프로그램을 보고 최상위 ${topK}개를 선정하여 JSON으로 반환하세요.
각 추천에는 id, score(0-1), reason(1-2문장)을 포함하세요.`,
              },
              {
                role: 'user',
                content: `프로필:
${JSON.stringify(profile, null, 2)}

후보 프로그램:
${programTexts}

위 후보 중 최상위 ${topK}개를 JSON으로 반환하세요:
{
  "recommendations": [
    { "id": "...", "score": 0.95, "reason": "..." }
  ]
}`,
              },
            ],
          });

          const rerankContent = rerankCompletion.choices[0].message?.content;
          if (rerankContent) {
            const rerankParsed = JSON.parse(rerankContent) as {
              recommendations: { id: string; score: number; reason: string }[];
            };

            programRecommendations = rerankParsed.recommendations
              ?.map((rec) => {
                const match = programs.find((p) => p.program.id === rec.id);
                return match
                  ? {
                      program: match.program,
                      score: rec.score ?? match.score,
                      reason: rec.reason ?? '',
                    }
                  : null;
              })
              .filter(Boolean) as ProgramRecommendation[];
          }
        }
      } catch (error) {
        console.warn('[recommendations] RAG fallback to rule-based:', error);
      }
    }

    // Fallback: 기존 규칙 기반 추천
    const jobs = jobsData as JobItem[];
    const policies = policiesData as PolicyItem[];
    const educations = educationsData as EducationItem[];

    const jobCandidates = filterJobs(profile, jobs, 12);
    let jobRecommendations: JobRecommendation[] = [];

    if (jobCandidates.length > 0) {
      try {
        const client = getOpenAIClient();
        const model = process.env.OPENAI_LLM_MODEL ?? "gpt-5";

        const completion = await client.chat.completions.create({
          model,
          // gpt-5 계열은 temperature 미지원 → 기본값 사용
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: rerankSystemPrompt },
            {
              role: "user",
              content: buildRerankUserPrompt(
                profile,
                jobCandidates.map((c) => c.job),
                topK,
              ),
            },
          ],
        });

        const content = completion.choices[0].message?.content;
        if (!content) throw new Error("LLM 응답이 비어 있습니다.");

        const parsed = JSON.parse(content) as {
          recommendations: { id: string; score: number; reason: string }[];
        };

        jobRecommendations =
          parsed.recommendations
            ?.map((rec) => {
              const match = jobCandidates.find((c) => c.job.id === rec.id);
              return match
                ? {
                    job: match.job,
                    score: rec.score ?? 0,
                    reason: rec.reason ?? "",
                  }
                : null;
            })
            .filter(Boolean) ?? [];
      } catch (error) {
        console.warn("[recommendations] LLM rerank fallback", error);
        // Fallback: heuristic scores normalized
        jobRecommendations = jobCandidates
          .slice(0, topK)
          .map(({ job, score }, idx) => ({
            job,
            score: Math.min(0.98, 0.6 + score * 0.05 - idx * 0.02),
            reason: "규칙 기반 매칭 결과입니다.",
          }));
      }
    }

    const matchedPolicies = filterPolicies(profile, policies, 3);
    const matchedEducations = filterEducations(profile, educations, 3);

    // RAG 추천이 있으면 우선 사용, 없으면 기존 규칙 기반 추천 사용
    const finalRecommendations =
      programRecommendations.length > 0
        ? {
            ragRecommendations: programRecommendations,
            jobRecommendations,
            policies: matchedPolicies,
            educations: matchedEducations,
            source: 'rag' as const,
          }
        : {
            jobRecommendations,
            policies: matchedPolicies,
            educations: matchedEducations,
            source: 'rule-based' as const,
          };

    return NextResponse.json(finalRecommendations);
  } catch (error) {
    console.error("[recommendations] error", error);
    return NextResponse.json(
      { error: "추천 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
