import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
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

export async function POST(req: Request) {
  try {
    const { profile, topK = 3 } = (await req.json()) as {
      profile: SeniorProfile;
      topK?: number;
    };

    if (!profile) {
      return NextResponse.json(
        { error: "profile 필드가 필요합니다." },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      jobRecommendations,
      policies: matchedPolicies,
      educations: matchedEducations,
    });
  } catch (error) {
    console.error("[recommendations] error", error);
    return NextResponse.json(
      { error: "추천 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
