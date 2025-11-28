'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { QUESTIONS } from "@/constants/questions";
import type {
  AnswerMap,
  EducationItem,
  JobItem,
  PolicyItem,
  ProgramItem,
  SeniorProfile,
} from "@/types/domain";

type JobRecommendation = { job: JobItem; score: number; reason: string };
type ProgramRecommendation = {
  program: ProgramItem;
  score: number;
  reason: string;
};
type RecommendationResponse = {
  ragRecommendations?: ProgramRecommendation[];
  jobRecommendations: JobRecommendation[];
  policies: PolicyItem[];
  educations: EducationItem[];
  source?: 'rag' | 'rule-based';
};

const initialAnswers = QUESTIONS.map(() => "");

function answersToMap(list: string[]): AnswerMap {
  return list.reduce<AnswerMap>((acc, val, idx) => {
    acc[`q${idx + 1}`] = val;
    return acc;
  }, {});
}

async function playTts(text: string) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}

function formatSalary(job: JobItem) {
  return `${job.min_salary.toLocaleString()} ~ ${job.max_salary.toLocaleString()}원`;
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [profile, setProfile] = useState<SeniorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [recommendations, setRecommendations] =
    useState<RecommendationResponse | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [readingResult, setReadingResult] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const progressText = `${currentQuestion + 1}/${
    QUESTIONS.length
  } 질문 진행 중`;

  useEffect(() => {
    if (started && currentQuestion < QUESTIONS.length) {
      speakCurrentQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, currentQuestion]);

  useEffect(() => {
    const allAnswered = answers.every((a) => a.trim().length > 0);
    if (allAnswered && !profile && !loadingProfile) {
      generateProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  useEffect(() => {
    if (profile && !recommendations && !loadingRecs) {
      fetchRecommendations(profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const speakCurrentQuestion = async () => {
    const text = QUESTIONS[currentQuestion];
    setStatusMsg("질문을 읽는 중...");
    await playTts(text);
    setStatusMsg("녹음 버튼을 눌러 답변해주세요.");
  };

  const startInterview = async () => {
    setStarted(true);
    setStatusMsg("질문을 읽고 있습니다.");
    await speakCurrentQuestion();
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await handleTranscription(blob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setStatusMsg("녹음 중입니다. 말씀을 마치면 정지 버튼을 눌러주세요.");
    } catch (error) {
      console.error(error);
      setStatusMsg("마이크 접근이 허용되지 않았습니다. 권한을 확인해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setTranscribing(true);
    setStatusMsg("음성을 텍스트로 변환 중...");
    try {
      const formData = new FormData();
      formData.append("file", blob, "answer.webm");

      const res = await fetch("/api/stt", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "STT 실패");

      const text = data.text as string;
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestion] = text || "(빈 응답)";
        return next;
      });
      setStatusMsg("음성 인식 완료! 잠시 후 다음 질문으로 넘어갑니다.");

      setTimeout(() => {
        setCurrentQuestion((prev) =>
          prev + 1 < QUESTIONS.length ? prev + 1 : prev,
        );
      }, 700);
    } catch (error) {
      console.error(error);
      setStatusMsg("음성 인식에 실패했습니다. 다시 녹음해주세요.");
    } finally {
      setTranscribing(false);
    }
  };

  const handleManualAdvance = () => {
    setAnswers((prev) => {
      const next = [...prev];
      if (!next[currentQuestion]?.trim()) {
        next[currentQuestion] = "(미응답)";
      }
      return next;
    });
    setCurrentQuestion((prev) =>
      prev + 1 < QUESTIONS.length ? prev + 1 : prev,
    );
  };

  const generateProfile = async () => {
    setLoadingProfile(true);
    setStatusMsg("모든 답변을 모아 프로필을 만드는 중입니다...");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersToMap(answers) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "프로필 생성 실패");
      setProfile(data.profile as SeniorProfile);
      setStatusMsg("프로필이 생성되었습니다. 추천을 준비합니다.");
    } catch (error) {
      console.error(error);
      setStatusMsg("프로필 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchRecommendations = async (pf: SeniorProfile) => {
    setLoadingRecs(true);
    setStatusMsg("추천을 만드는 중입니다...");
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: pf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추천 생성 실패");
      setRecommendations(data as RecommendationResponse);
      setStatusMsg("추천이 준비되었습니다!");
    } catch (error) {
      console.error(error);
      setStatusMsg("추천 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoadingRecs(false);
    }
  };

  const speakResults = async () => {
    if (!recommendations) return;
    setReadingResult(true);
    const lines: string[] = [];

    recommendations.jobRecommendations.slice(0, 3).forEach((rec, idx) => {
      lines.push(
        `${idx + 1}번, ${rec.job.title}. 이유: ${rec.reason || "적합도 높음"}`,
      );
    });
    if (recommendations.policies.length) {
      const p = recommendations.policies[0];
      lines.push(`정책 추천: ${p.title}. 혜택: ${p.benefit}`);
    }
    await playTts(lines.join("\n"));
    setReadingResult(false);
  };

  const answeredCount = useMemo(
    () => answers.filter((a) => a.trim()).length,
    [answers],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">
            Reborn · Voice-Only MVP
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            부울경 시니어를 위한 음성 기반 커리어 내비게이션
          </h1>
          <p className="max-w-3xl text-lg text-slate-200/80">
            텍스트 입력 없이 10개의 질문에 음성으로 답하면, 프로필을 만들고
            맞춤 일자리·정책·교육을 안내합니다.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-emerald-200/80">현재 진행</p>
              <p className="text-2xl font-semibold">
                {answeredCount < QUESTIONS.length
                  ? progressText
                  : "질문 완료"}
              </p>
            </div>
            {!started ? (
              <button
                onClick={startInterview}
                className="rounded-full bg-emerald-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                시작하기 (질문 듣기)
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={speakCurrentQuestion}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm transition hover:bg-white/10"
                >
                  질문 다시 듣기
                </button>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    recording
                      ? "bg-rose-400 text-slate-900"
                      : "bg-emerald-400 text-slate-900 hover:bg-emerald-300"
                  }`}
                >
                  {recording ? "녹음 정지" : "녹음 시작"}
                </button>
                <button
                  onClick={handleManualAdvance}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm transition hover:bg-white/10"
                >
                  답변 완료 / 다음으로
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 p-5">
            <p className="text-sm text-emerald-200/80">질문</p>
            <p className="mt-2 text-2xl font-semibold leading-snug">
              {QUESTIONS[Math.min(currentQuestion, QUESTIONS.length - 1)]}
            </p>
            <p className="mt-4 text-sm text-slate-200/80">
              {statusMsg || "질문을 듣고, 바로 녹음 버튼을 눌러 답해주세요."}
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-emerald-200/70">현재 답변</p>
              <textarea
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-base text-white outline-none focus:border-emerald-300/60"
                rows={4}
                value={answers[currentQuestion] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const next = [...prev];
                    next[currentQuestion] = e.target.value;
                    return next;
                  })
                }
                placeholder="음성 인식 결과가 여기에 표시됩니다. 필요 시 직접 수정하세요."
              />
              <div className="mt-2 text-xs text-slate-300/70">
                {transcribing
                  ? "음성 인식 중..."
                  : recording
                    ? "녹음 중입니다."
                    : "녹음을 마치면 자동으로 채워집니다."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-emerald-200/70">답변 현황</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUESTIONS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`rounded-full px-3 py-1 text-xs ${
                      answers[idx]?.trim()
                        ? "bg-emerald-400 text-slate-900"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    Q{idx + 1} {answers[idx]?.trim() ? "완료" : "대기"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">프로필 / 페르소나</h2>
              {loadingProfile && (
                <span className="text-sm text-emerald-200">생성 중...</span>
              )}
            </div>
            {profile ? (
              <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-100">
                <p className="text-base font-semibold text-emerald-200">
                  {profile.persona_summary}
                </p>
                <p>
                  <strong className="text-emerald-200">이전 경력:</strong>{" "}
                  {profile.previous_job}
                </p>
                <p>
                  <strong className="text-emerald-200">주요 스킬:</strong>{" "}
                  {profile.skills?.join(", ")}
                </p>
                <p>
                  <strong className="text-emerald-200">활동량/자세:</strong>{" "}
                  {profile.activity_level} · {profile.work_posture}
                </p>
                <p>
                  <strong className="text-emerald-200">희망 근무:</strong>{" "}
                  주 {profile.weekly_work_days}일 · {profile.salary_expectation}
                </p>
                <p>
                  <strong className="text-emerald-200">성향:</strong>{" "}
                  {profile.social_preference} · {profile.learning_preference}
                </p>
                <p>
                  <strong className="text-emerald-200">디지털:</strong>{" "}
                  {profile.digital_literacy}
                </p>
                <p>
                  <strong className="text-emerald-200">동기:</strong>{" "}
                  {profile.motivation}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-200/70">
                10개 질문 답변이 끝나면 자동으로 프로필을 생성합니다.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">추천 결과</h2>
              {loadingRecs && (
                <span className="text-sm text-emerald-200">계산 중...</span>
              )}
            </div>

            {recommendations ? (
              <div className="mt-4 space-y-5 text-sm text-slate-100">
                {recommendations.source && (
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {recommendations.source === 'rag'
                      ? '🔍 RAG 기반 추천 (벡터 검색)'
                      : '📋 규칙 기반 추천'}
                  </div>
                )}

                {recommendations.ragRecommendations &&
                recommendations.ragRecommendations.length > 0 ? (
                  <div>
                    <p className="text-base font-semibold text-emerald-200">
                      맞춤 프로그램 Top {recommendations.ragRecommendations.length}
                    </p>
                    <div className="mt-2 space-y-3">
                      {recommendations.ragRecommendations.map((rec, idx) => (
                        <div
                          key={rec.program.id}
                          className="rounded-2xl border border-white/10 bg-black/30 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">
                                #{idx + 1}
                              </div>
                              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                                {rec.program.type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300/70">
                              적합도 {(rec.score ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <p className="mt-1 text-lg font-semibold">
                            {rec.program.title}
                          </p>
                          <p className="text-slate-200/80">{rec.reason}</p>
                          <p className="mt-1 text-xs text-slate-300/70">
                            {rec.program.region}
                            {rec.program.benefits &&
                              ` · ${rec.program.benefits}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-base font-semibold text-emerald-200">
                    일자리 Top 3
                  </p>
                  <div className="mt-2 space-y-3">
                    {recommendations.jobRecommendations.map((rec, idx) => (
                      <div
                        key={rec.job.id}
                        className="rounded-2xl border border-white/10 bg-black/30 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">
                            #{idx + 1}
                          </div>
                          <div className="text-xs text-slate-300/70">
                            적합도 {(rec.score ?? 0).toFixed(2)}
                          </div>
                        </div>
                        <p className="mt-1 text-lg font-semibold">
                          {rec.job.title}
                        </p>
                        <p className="text-slate-200/80">{rec.reason}</p>
                        <p className="mt-1 text-xs text-slate-300/70">
                          {rec.job.region} · 주 {rec.job.work_days}일 ·{" "}
                          {rec.job.activity_level} · {rec.job.posture} · 급여{" "}
                          {formatSalary(rec.job)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-base font-semibold text-emerald-200">
                    정책 추천
                  </p>
                  <ul className="mt-2 space-y-2">
                    {recommendations.policies.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-white/10 bg-black/30 p-3"
                      >
                        <p className="font-semibold">{p.title}</p>
                        <p className="text-slate-200/80">{p.benefit}</p>
                        <p className="text-xs text-slate-300/70">
                          대상 {p.target_age} · 지역 {p.region}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-base font-semibold text-emerald-200">
                    교육 추천
                  </p>
                  <ul className="mt-2 space-y-2">
                    {recommendations.educations.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-xl border border-white/10 bg-black/30 p-3"
                      >
                        <p className="font-semibold">{e.title}</p>
                        <p className="text-slate-200/80">{e.summary}</p>
                        <p className="text-xs text-slate-300/70">
                          {e.region} · {e.mode} · {e.duration} · {e.cost || ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={speakResults}
                  disabled={readingResult}
                  className="w-full rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {readingResult ? "음성 안내 중..." : "추천 음성으로 듣기"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-200/70">
                프로필 생성 후 맞춤 일자리·정책·교육을 보여드립니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
