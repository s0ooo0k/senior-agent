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
import VoiceIndicator from "@/components/VoiceIndicator";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { ArrowRight, Mic, ChevronRight } from "lucide-react";

type JobRecommendation = { job: JobItem; score: number; reason: string };
type ProgramRecommendation = {
  program: ProgramItem;
  score: number;
  reason: string;
};
type RecommendationResponse = {
  ragJobRecommendations?: ProgramRecommendation[];
  ragPolicyRecommendations?: ProgramRecommendation[];
  ragEducationRecommendations?: ProgramRecommendation[];
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

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "TTS API 호출 실패");
  }

  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  try {
    await audio.play();
  } catch (err) {
    console.error("오디오 재생 실패:", err);
    throw new Error("오디오 재생이 차단되었습니다. 브라우저 설정을 확인해주세요.");
  }
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
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'speaking' | 'listening' | 'processing'>('idle');
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
    setVoiceStatus('speaking');
    setStatusMsg("질문을 읽는 중...");
    try {
      await playTts(text);
      setVoiceStatus('idle');
      setStatusMsg("녹음 버튼을 눌러 답변해주세요.");
    } catch (error) {
      console.error("TTS 에러:", error);
      setVoiceStatus('idle');
      setStatusMsg("음성 출력에 실패했습니다. 텍스트를 읽고 답변해주세요.");
    }
  };

  const startInterview = async () => {
    setStarted(true);
    setStatusMsg("질문을 읽고 있습니다.");
    try {
      await speakCurrentQuestion();
    } catch (error) {
      console.error("인터뷰 시작 에러:", error);
      setVoiceStatus('idle');
      setStatusMsg("시작 중 오류가 발생했습니다. 계속 진행하시려면 녹음 버튼을 눌러주세요.");
    }
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
      setVoiceStatus('listening');
      setStatusMsg("녹음 중입니다. 말씀을 마치면 정지 버튼을 눌러주세요.");
    } catch (error) {
      console.error(error);
      setVoiceStatus('idle');
      setStatusMsg("마이크 접근이 허용되지 않았습니다. 권한을 확인해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setVoiceStatus('processing');
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setTranscribing(true);
    setVoiceStatus('processing');
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
      setVoiceStatus('idle');
      setStatusMsg("음성 인식 완료! 잠시 후 다음 질문으로 넘어갑니다.");

      setTimeout(() => {
        setCurrentQuestion((prev) =>
          prev + 1 < QUESTIONS.length ? prev + 1 : prev,
        );
      }, 700);
    } catch (error) {
      console.error(error);
      setVoiceStatus('idle');
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

  const handleStart = async () => {
    try {
      // Request microphone permission early
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStarted(true);
      setStatusMsg("질문을 읽고 있습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        alert("서비스 이용을 위해 마이크 권한이 필요합니다.");
      } else {
        console.error("마이크 권한 에러:", error);
        alert("마이크 접근에 실패했습니다. 브라우저 설정을 확인해주세요.");
      }
    }
  };

  // Landing page (onboarding screen)
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* App Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">리본 (Reborn)</h1>
            <p className="text-blue-100 text-sm">
              시니어 커리어 내비게이션
            </p>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            <div className="bg-blue-50 p-8 rounded-2xl mb-8">
              <p className="text-lg leading-relaxed text-slate-800 mb-6">
                복잡한 입력 없이<br/>
                <span className="font-bold text-blue-700 text-xl">목소리</span>로만 대화하세요.
              </p>
              <div className="flex justify-center mb-6">
                <div className="bg-white p-6 rounded-full shadow-lg">
                  <Mic className="w-16 h-16 text-blue-600" />
                </div>
              </div>
              <p className="text-base text-slate-600 leading-relaxed">
                10가지 질문에 답해주시면<br/>
                딱 맞는 일자리를 찾아드립니다.
              </p>
            </div>

            <button
              onClick={handleStart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-5 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3"
            >
              <span>시작하기</span>
              <ArrowRight className="w-7 h-7" />
            </button>

            <p className="mt-6 text-slate-400 text-xs">
              부산·울산·경남 시니어를 위한 맞춤형 서비스
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Interview screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <p className="text-xs uppercase tracking-wider text-blue-100 mb-1">
            Reborn
          </p>
          <h1 className="text-xl font-bold text-white">
            음성 기반 커리어 내비게이션
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6 flex flex-col gap-6">

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-slate-500">현재 진행</p>
              <p className="text-2xl font-bold text-slate-800">
                {answeredCount < QUESTIONS.length
                  ? progressText
                  : "질문 완료"}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-6 mb-6">
            <p className="text-sm font-medium text-blue-600 mb-3">질문 {currentQuestion + 1} / {QUESTIONS.length}</p>
            <p className="text-2xl font-bold leading-snug text-slate-800 break-keep mb-4">
              {QUESTIONS[Math.min(currentQuestion, QUESTIONS.length - 1)]}
            </p>

            {/* Voice Indicator */}
            <VoiceIndicator status={voiceStatus} />
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={speakCurrentQuestion}
              className="rounded-xl border-2 border-blue-600 px-6 py-3 text-base font-bold text-blue-600 transition-colors hover:bg-blue-50"
            >
              질문 다시 듣기
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`rounded-xl px-6 py-3 text-base font-bold transition-transform active:scale-95 ${
                recording
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {recording ? "녹음 정지" : "녹음 시작"}
            </button>
            <button
              onClick={handleManualAdvance}
              className="rounded-xl bg-slate-200 px-6 py-3 text-base font-bold text-slate-700 transition-colors hover:bg-slate-100"
            >
              답변 완료 / 다음으로
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">현재 답변</p>
              <textarea
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
              <div className="mt-2 text-xs text-slate-500">
                {transcribing
                  ? "음성 인식 중..."
                  : recording
                    ? "녹음 중입니다."
                    : "녹음을 마치면 자동으로 채워집니다."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">답변 현황</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUESTIONS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      answers[idx]?.trim()
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-600"
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
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">프로필 / 페르소나</h2>
              {loadingProfile && (
                <span className="text-sm text-blue-600">생성 중...</span>
              )}
            </div>
            {profile ? (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-base font-bold text-blue-700 break-keep">
                    {profile.persona_summary}
                  </p>
                </div>
                <div className="grid gap-3">
                  <p>
                    <strong className="text-slate-800">이전 경력:</strong>{" "}
                    {profile.previous_job}
                  </p>
                  <p>
                    <strong className="text-slate-800">주요 스킬:</strong>{" "}
                    {profile.skills?.join(", ")}
                  </p>
                  <p>
                    <strong className="text-slate-800">활동량/자세:</strong>{" "}
                    {profile.activity_level} · {profile.work_posture}
                  </p>
                  <p>
                    <strong className="text-slate-800">희망 근무:</strong>{" "}
                    주 {profile.weekly_work_days}일 · {profile.salary_expectation}
                  </p>
                  <p>
                    <strong className="text-slate-800">성향:</strong>{" "}
                    {profile.social_preference} · {profile.learning_preference}
                  </p>
                  <p>
                    <strong className="text-slate-800">디지털:</strong>{" "}
                    {profile.digital_literacy}
                  </p>
                  <p>
                    <strong className="text-slate-800">동기:</strong>{" "}
                    {profile.motivation}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                10개 질문 답변이 끝나면 자동으로 프로필을 생성합니다.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">추천 결과</h2>
              {loadingRecs && (
                <span className="text-sm text-blue-600">계산 중...</span>
              )}
            </div>

            {recommendations ? (
              <div className="mt-4 space-y-5 text-sm text-slate-700">
                {recommendations.source && (
                  <div className="rounded-lg bg-green-100 px-3 py-2 text-xs font-medium text-green-700">
                    {recommendations.source === 'rag'
                      ? '🔍 RAG 기반 추천 (벡터 검색)'
                      : '📋 규칙 기반 추천'}
                  </div>
                )}

                {/* RAG 일자리 추천 */}
                {recommendations.ragJobRecommendations &&
                recommendations.ragJobRecommendations.length > 0 ? (
                  <div>
                    <p className="text-base font-semibold text-emerald-200">
                      맞춤 일자리 Top {recommendations.ragJobRecommendations.length}
                    </p>
                    <div className="mt-2 space-y-3">
                      {recommendations.ragJobRecommendations.map((rec, idx) => (
                        <div
                          key={rec.program.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {idx === 0 && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                  1순위 추천
                                </span>
                              )}
                              {idx > 0 && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                  {idx + 1}순위 추천
                                </span>
                              )}
                              <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                {rec.program.type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              적합도 {(rec.score ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <p className="text-lg font-bold text-slate-800 mb-2 break-keep">
                            {rec.program.title}
                          </p>
                          <div className="bg-blue-50 p-3 rounded-xl mb-2">
                            <p className="text-slate-700 font-medium leading-snug break-keep">
                              {rec.reason}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
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
                  <p className="text-base font-bold text-slate-800 mb-3">
                    일자리 Top 3
                  </p>
                  <div className="mt-2 space-y-3">
                    {recommendations.jobRecommendations.map((rec, idx) => (
                      <div
                        key={rec.job.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                1순위 추천
                              </span>
                            )}
                            {idx > 0 && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                {idx + 1}순위 추천
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            적합도 {(rec.score ?? 0).toFixed(2)}
                          </div>
                        </div>
                        <p className="text-lg font-bold text-slate-800 mb-2 break-keep">
                          {rec.job.title}
                        </p>
                        <div className="bg-blue-50 p-3 rounded-xl mb-2">
                          <p className="text-slate-700 font-medium leading-snug break-keep">
                            {rec.reason}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {rec.job.region} · 주 {rec.job.work_days}일 ·{" "}
                          {rec.job.activity_level} · {rec.job.posture} · 급여{" "}
                          {formatSalary(rec.job)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-base font-bold text-slate-800 mb-3">
                    정책 추천
                  </p>
                  <ul className="mt-2 space-y-2">
                    {recommendations.policies.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <p className="font-bold text-slate-800 mb-1 break-keep">{p.title}</p>
                        <p className="text-slate-700 mb-2">{p.benefit}</p>
                        <p className="text-xs text-slate-500">
                          대상 {p.target_age} · 지역 {p.region}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-base font-bold text-slate-800 mb-3">
                    교육 추천
                  </p>
                  <ul className="mt-2 space-y-2">
                    {recommendations.educations.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-xl border border-slate-100 bg-green-50 p-4"
                      >
                        <p className="font-bold text-green-700 mb-1 break-keep">{e.title}</p>
                        <p className="text-slate-700 mb-2">{e.summary}</p>
                        <p className="text-xs text-slate-500">
                          {e.region} · {e.mode} · {e.duration} · {e.cost || ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={speakResults}
                  disabled={readingResult}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {readingResult ? "음성 안내 중..." : "추천 음성으로 듣기"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                프로필 생성 후 맞춤 일자리·정책·교육을 보여드립니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
