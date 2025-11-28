# 리본(Reborn) — 음성 기반 시니어 커리어 내비게이션 MVP

부산·울산·경남(부울경) 60–69세 시니어를 대상으로 하는 **음성 중심 Zero-UI** 커리어 내비게이션 데모입니다. 10개의 고정 질문에 음성으로 답하면, LLM이 프로필을 만들고 JSON 데이터에서 일자리·정책·교육을 추천한 뒤 TTS로 읽어줍니다.

## 핵심 기능
- 브라우저 **음성 녹음 → STT(Whisper)** → 답변 누적
- 답변 10개 → **LLM(GPT-5)** 단일 호출로 프로필/페르소나 JSON 생성
- 로컬 JSON(jobs, policies, educations) + 간단 필터 → **LLM 재랭킹** 후 Top 3 일자리 추천
- 추천 결과를 **TTS**로 음성 안내

## 실행 방법
1) 환경 변수 설정  
   `.env.example` 복사 후 키 입력:
   ```
   cp .env.example .env.local
   ```
   - `OPENAI_API_KEY` : 필수
   - `OPENAI_LLM_MODEL` : 기본 `gpt-5`
   - `OPENAI_STT_MODEL` : 기본 `whisper-1`
   - `OPENAI_TTS_MODEL` : 기본 `tts-1`
   - `DEFAULT_REGION` : 지역 단서 없을 때 사용할 기본값(기본 부산)

2) 로컬 개발 서버
   ```
   npm run dev
   ```
   브라우저에서 `http://localhost:3000` 접속 → “시작하기” 버튼을 누르고 음성 흐름을 테스트합니다.

## API 라우트 개요
- `POST /api/stt` : 음성 multipart/form-data(`file`) → STT 텍스트 반환
- `POST /api/tts` : `{ text, voice? }` → mp3 바이너리 반환
- `POST /api/profile` : `{ answers }` → 시니어 프로필/페르소나 JSON
- `POST /api/recommendations` : `{ profile }` → 일자리 Top3 + 정책/교육 추천

## 데이터 구조
- `src/data/jobs.json` : id, title, region, work_days, activity_level, posture, 급여 범위 등
- `src/data/policies.json` : 지역·연령 대상, 혜택, 설명
- `src/data/educations.json` : 지역/온라인, 기간, 비용, 요약

## 확장 포인트
- Qdrant 등 벡터 DB 도입 시, `matching` 모듈을 메타데이터 필터 + 벡터 검색으로 대체
- STT/TTS/LLM 모델명을 env로 분리해 다른 제공사 모델로 전환 가능
- 질문 세트나 프롬프트를 `src/constants` / `src/lib/prompts`에서 쉽게 수정

## 주의
- 브라우저의 마이크 권한이 필요합니다.
- 실제 OpenAI API 키가 필요하며, 과금이 발생할 수 있습니다.
