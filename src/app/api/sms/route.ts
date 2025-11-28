
import { type NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

// SMS 발송 테스트를 위한 POST API
export async function POST(req: NextRequest) {
  try {
    // 요청 본문에서 to(수신자 번호)와 text(메시지 내용)를 추출합니다.
    const { to, text } = await req.json();

    // 필수 정보가 누락된 경우 에러를 반환합니다.
    if (!to || !text) {
      return NextResponse.json(
        { message: "수신자 번호(to)와 메시지 내용(text)은 필수입니다." },
        { status: 400 }
      );
    }

    // 분리된 sendSms 함수를 호출하여 SMS를 발송합니다.
    const result = await sendSms(to, text);

    // 성공 결과를 클라이언트에게 반환합니다.
    return NextResponse.json(result);

  } catch (error: any) {
    // 에러 발생 시 에러 내용을 클라이언트에게 반환합니다.
    console.error("API 라우트에서 SMS 발송 중 에러:", error.message);
    return NextResponse.json(
      { message: "SMS 발송 중 서버에서 에러가 발생했습니다.", error: error.message },
      { status: 500 }
    );
  }
}
