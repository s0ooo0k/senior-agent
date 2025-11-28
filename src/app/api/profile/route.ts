import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { buildProfileUserPrompt, profileSystemPrompt } from "@/lib/prompts";
import type { AnswerMap, SeniorProfile } from "@/types/domain";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { answers } = (await req.json()) as { answers: AnswerMap };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "answers 필드가 필요합니다." },
        { status: 400 },
      );
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_LLM_MODEL ?? "gpt-5";

    const completion = await client.chat.completions.create({
      model,
      // gpt-5 계열은 temperature 미지원 → 기본값 사용
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: profileSystemPrompt },
        { role: "user", content: buildProfileUserPrompt(answers) },
      ],
    });

    const content = completion.choices[0].message?.content;
    if (!content) throw new Error("LLM 응답이 비어 있습니다.");

    const profile = JSON.parse(content) as SeniorProfile;

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile] error", error);
    return NextResponse.json(
      { error: "프로필 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
