import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "음성 파일(file)이 필요합니다." },
        { status: 400 },
      );
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_STT_MODEL ?? "whisper-1";

    const transcription = await client.audio.transcriptions.create({
      file,
      model,
      language: "ko",
      temperature: 0.2,
    });

    console.info("[stt] transcription:", transcription.text);

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("[stt] error", error);
    return NextResponse.json(
      { error: "음성 인식 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
