import { QUESTIONS } from "@/constants/questions";
import type { AnswerMap, JobItem, SeniorProfile } from "@/types/domain";

export const profileSystemPrompt = `
너는 부산·울산·경남 시니어(60-69세)의 커리어 내비게이터다.
아래 답변 6개를 읽고 프로필 JSON을 정확히 생성해라.
- 반드시 JSON만 출력한다.
- 숫자/범위는 최대한 구체적으로 적는다.
- weekly_work_days는 숫자만 적는다.
`;

export function buildProfileUserPrompt(answers: AnswerMap) {
  const qa = QUESTIONS.map((q, idx) => `Q${idx + 1}: ${q}\nA${idx + 1}: ${answers[`q${idx + 1}`] ?? ""}`).join("\n\n");
  return `
다음은 사용자의 6개 답변이다.

${qa}

다음 스키마로 JSON을 만들어라:
{
  "previous_job": "이전 경력 요약",
  "skills": ["핵심 역량 3~5개"],
  "activity_level": "낮음|중간|높음 중 하나",
  "work_posture": "앉아서/서서 등 선호 자세",
  "weekly_work_days": 0,
  "salary_expectation": "희망 급여",
  "social_preference": "사람들과 함께 / 혼자 / 중간",
  "learning_preference": "새로 배우기 선호/익숙한 일 선호 등",
  "digital_literacy": "낮음/중간/높음 + 근거",
  "motivation": "주요 목적 요약",
  "persona_summary": "2~3문장으로 사람 소개",
  "region": "가능하면 지역 단서 추출, 없으면 부산"
}
`;
}

export const rerankSystemPrompt = `
너는 시니어에게 맞는 일자리를 점수화하는 랭커다.
입력: 시니어 프로필 JSON과 후보 일자리 목록.
출력: JSON만, 각 추천에 id/score/reason을 포함한다.
- score는 0~1 사이 숫자, 소수 2자리까지.
- reason은 1~2문장 한국어로, 왜 맞는지 설명.
`;

export function buildRerankUserPrompt(
  profile: SeniorProfile,
  candidates: JobItem[],
  topN = 3,
) {
  const candidateText = candidates
    .map(
      (c) =>
        `- id: ${c.id}\n  title: ${c.title}\n  region: ${c.region}\n  work_days: ${c.work_days}\n  activity: ${c.activity_level}\n  posture: ${c.posture}\n  salary: ${c.min_salary}~${c.max_salary}\n  social: ${c.social_level}\n  digital: ${c.requires_digital ? "필요" : "불필요"}\n  tags: ${c.tags.join(", ")}`,
    )
    .join("\n\n");

  return `
프로필:
${JSON.stringify(profile, null, 2)}

후보 일자리:
${candidateText}

위 후보 중 최상위 ${topN}개를 골라 JSON으로 반환해라:
{
  "recommendations": [
    { "id": "job_001", "score": 0.92, "reason": "간단한 이유" }
  ]
}
`;
}
