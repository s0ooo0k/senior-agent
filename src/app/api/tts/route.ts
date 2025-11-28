import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text, voice = "shimmer" } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text 필드가 비어 있습니다." },
        { status: 400 },
      );
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

    const speech = await client.audio.speech.create({
      model,
      voice,
      input: text,
      format: "mp3",
      speed: 1.2,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tts] error", error);
    return NextResponse.json(
      { error: "음성 합성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
