
import crypto from "crypto";
import axios from "axios";

/**
 * 지정된 번호로 SMS를 발송하는 함수
 * @param to - 수신자 전화번호
 * @param text - 발송할 메시지 내용
 * @returns Promise<any> - SOLAPI API 응답 결과
 */
export async function sendSms(to: string, text: string) {
  // .env.local 파일에서 환경 변수를 불러옵니다.
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const fromNumber = process.env.SOLAPI_FROM_NUMBER;

  // 환경 변수가 설정되지 않은 경우 에러를 발생시킵니다.
  if (!apiKey || !apiSecret || !fromNumber) {
    throw new Error("SOLAPI 환경 변수가 설정되지 않았습니다.");
  }

  // --- SOLAPI 인증 정보 생성 ---
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  // ----------------------------------------------------

  // SOLAPI 메시지 발송 API 엔드포인트
  const url = "https://api.solapi.com/messages/v4/send";
  
  // API에 보낼 데이터 형식
  const data = {
    message: {
      to: to,
      from: fromNumber,
      text: text,
    },
  };

  try {
    // axios를 사용하여 SOLAPI에 POST 요청을 보냅니다.
    const response = await axios.post(url, data, {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    return response.data;
  } catch (error: any) {
    // 에러 발생 시 에러 내용을 콘솔에 출력하고, 다시 에러를 발생시켜 호출한 쪽에서 처리하도록 합니다.
    console.error("SMS 발송 중 에러 발생:", error.response?.data || error.message);
    throw new Error("SMS 발송에 실패했습니다.");
  }
}
