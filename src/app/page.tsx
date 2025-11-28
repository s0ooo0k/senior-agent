"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/constants/questions";
import type {
  AnswerMap,
  EducationItem,
  JobItem,
  PolicyItem,
  ProgramItem,
  SeniorProfile,
} from "@/types/domain";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { ArrowRight, Mic, Sparkles, Volume2 } from "lucide-react";

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
  source?: "rag" | "rule-based";
};

const initialAnswers = QUESTIONS.map(() => "");

function answersToMap(list: string[]): AnswerMap {
  return list.reduce<AnswerMap>((acc, val, idx) => {
    acc[`q${idx + 1}`] = val;
    return acc;
  }, {});
}

function formatSalary(job: JobItem) {
  return `${job.min_salary.toLocaleString()} ~ ${job.max_salary.toLocaleString()}원`;
}

export default function Home() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "speaking" | "listening" | "processing"
  >("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [profile, setProfile] = useState<SeniorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [recommendations, setRecommendations] =
    useState<RecommendationResponse | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [readingResult, setReadingResult] = useState(false);
  const [micDisabled, setMicDisabled] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false); // SMS 팝업 상태 추가

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsSessionRef = useRef(0);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const answeredCount = useMemo(
    () => answers.filter((a) => a.trim()).length,
    [answers]
  );
  const totalQuestions = QUESTIONS.length;
  const currentQuestionSafe =
    QUESTIONS[Math.min(currentQuestion, totalQuestions - 1)];
  const progressPercent = Math.min(
    100,
    Math.round((answeredCount / totalQuestions) * 100)
  );
  const allAnswered = answeredCount >= totalQuestions;
  const showResults = started && allAnswered;

  const cancelTtsPlayback = () => {
    ttsSessionRef.current += 1;
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    const audio = ttsAudioRef.current;
    if (audio) {
      if (!audio.paused) {
        audio.pause();
      }
      audio.currentTime = 0;
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
    }
    ttsAudioRef.current = null;
  };

  const playTts = async (
    text: string
  ): Promise<"ended" | "stopped" | "cancelled"> => {
    cancelTtsPlayback();
    const sessionId = ttsSessionRef.current;
    const controller = new AbortController();
    ttsAbortRef.current = controller;

    let res: Response;
    try {
      res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return "cancelled";
      }
      throw err;
    }

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "TTS API 호출 실패");
    }

    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    ttsAudioRef.current = audio;
    ttsAbortRef.current = null;

    if (ttsSessionRef.current !== sessionId) {
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
      ttsAudioRef.current = null;
      return "cancelled";
    }

    const result = await new Promise<"ended" | "stopped">((resolve, reject) => {
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (audio.src.startsWith("blob:")) {
          URL.revokeObjectURL(audio.src);
        }
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null;
        }
        if (ttsAbortRef.current) {
          ttsAbortRef.current = null;
        }
      };

      audio.onended = () => {
        cleanup();
        resolve("ended");
      };

      audio.onpause = () => {
        if (audio.ended) return;
        cleanup();
        resolve("stopped");
      };

      audio.onerror = (e) => {
        cleanup();
        reject(e);
      };

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });

    if (ttsSessionRef.current !== sessionId) {
      return "cancelled";
    }

    return result;
  };

  useEffect(() => {
    return () => {
      cancelTtsPlayback();
    };
  }, []);

  useEffect(() => {
    if (started && currentQuestion < totalQuestions) {
      speakCurrentQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, currentQuestion]);

  useEffect(() => {
    const done = answers.every((a) => a.trim().length > 0);
    if (done && !profile && !loadingProfile) {
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
    if (currentQuestion >= totalQuestions) return;
    const text = QUESTIONS[currentQuestion];
    setVoiceStatus("speaking");
    setStatusMsg("질문을 읽는 중...");
    try {
      const result = await playTts(text);
      if (result === "ended" || result === "stopped") {
        setVoiceStatus("idle");
        setStatusMsg("녹음 버튼을 눌러 답변해주세요.");
      }
    } catch (error) {
      console.error("TTS 에러:", error);
      setVoiceStatus("idle");
      setStatusMsg("음성 출력에 실패했습니다. 텍스트를 읽고 답변해주세요.");
    }
  };

  const startRecording = async () => {
    if (
      recording ||
      micDisabled ||
      transcribing ||
      voiceStatus === "processing"
    )
      return;
    cancelTtsPlayback();
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
      setVoiceStatus("listening");
      setStatusMsg("녹음 중입니다. 말씀을 마치면 정지 버튼을 눌러주세요.");
    } catch (error) {
      console.error(error);
      setVoiceStatus("idle");
      setStatusMsg("마이크 접근이 허용되지 않았습니다. 권한을 확인해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      setMicDisabled(true);
      mediaRecorderRef.current.stop();
      setRecording(false);
      setVoiceStatus("processing");
      setStatusMsg("음성을 처리하는 중입니다. 잠시만 기다려주세요.");
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setMicDisabled(true);
    setTranscribing(true);
    setVoiceStatus("processing");
    setStatusMsg("음성을 텍스트로 변환 중...");
    try {
      const formData = new FormData();
      formData.append("file", blob, "answer.webm");

      const res = await fetch("/api/stt", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "STT 실패");

      const text = data.text as string;
      console.info("[client] STT result:", text);
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestion] = text || "(빈 응답)";
        return next;
      });
      setVoiceStatus("idle");
      setStatusMsg("음성 인식 완료! 잠시 후 다음 질문으로 넘어갑니다.");

      setTimeout(() => {
        setCurrentQuestion((prev) => {
          const next = prev + 1 < totalQuestions ? prev + 1 : prev;
          return next;
        });
        setMicDisabled(false);
      }, 700);
    } catch (error) {
      console.error(error);
      setVoiceStatus("idle");
      setStatusMsg("음성 인식에 실패했습니다. 다시 녹음해주세요.");
      setMicDisabled(false);
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
    setCurrentQuestion((prev) => (prev + 1 < totalQuestions ? prev + 1 : prev));
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

  const micButtonDisabled =
    !recording && (micDisabled || transcribing || voiceStatus === "processing");

  const speakResults = async () => {
    if (!recommendations) return;
    setReadingResult(true);
    const lines: string[] = [];

    recommendations.jobRecommendations.slice(0, 3).forEach((rec, idx) => {
      lines.push(
        `${idx + 1}번, ${rec.job.title}. 이유: ${rec.reason || "적합도 높음"}`
      );
    });
    if (recommendations.policies.length) {
      const p = recommendations.policies[0];
      lines.push(`정책 추천: ${p.title}. 혜택: ${p.benefit}`);
    }
    await playTts(lines.join("\n"));
    setReadingResult(false);
  };

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStarted(true);
      setStatusMsg("질문을 읽고 있습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        alert("서비스 이용을 위해 마이크 권한이 필요합니다.");
      } else {
        console.error("마이크 권한 에러:", error);
        alert("마이크 접근에 실패했습니다. 브라우저 설정을 확인해주세요.");
      }
    }
  };

  const LandingView = () => (
    <div className="relative overflow-hidden">
      <div className="relative grid min-h-[calc(100vh-180px)] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5 lg:space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-[#5d8df4] shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            음성만으로 인터뷰
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6c7ba4]">
              시니어 커리어 내비게이션
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl lg:text-6xl">
              AI 기반 <br className="hidden sm:block" />
              시니어 커리어 설계 <br className="hidden sm:block" />
              <span className="text-[#5d8df4]">음성</span>으로.
            </h1>
          </div>

          <p className="text-lg leading-relaxed text-slate-600">
            6개의 질문을 바탕으로 나만의 프로필 카드 생성
            <br className="hidden md:block" /> 나에게 꼭 맞는 일자리·정책·교육을 추천합니다.
          </p>

          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="primary">커리어 재시작</Badge>
            <Badge variant="secondary">새로운 직업</Badge>
            <Badge variant="secondary">미래 설계</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStart}
              icon={<ArrowRight className="h-5 w-5" />}
            >
              바로 시작하기
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push("/browse")}
            >
              공고 살펴보기
            </Button>
          </div>
        </div>

        <div className="relative h-full min-h-[560px]">
          <Image
            src="/mascot-ribbon.png"
            alt="리본을 든 러닝 캐릭터"
            width={340}
            height={340}
            priority
            className="absolute left-[-10%] top-[10%] drop-shadow-[0_40px_120px_-60px_rgba(69,110,220,0.45)]"
          />
          <Image
            src="/mascot-run.png"
            alt="뛰는 캐릭터"
            width={340}
            height={340}
            className="absolute right-[6%] top-[42%] hidden md:block scale-[0.96] drop-shadow-[0_32px_100px_-70px_rgba(69,110,220,0.45)]"
          />
        </div>
      </div>
    </div>
  );

  const InterviewView = () => (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 font-bold text-[#5d8df4] shadow">
          {currentQuestion + 1}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            현재 질문
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {currentQuestion + 1} / {totalQuestions}
          </p>
        </div>
        <div className="ml-4 h-2 w-28 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#5d8df4] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-700">
          {progressPercent}%
        </span>
      </div>

      <section className="w-full flex justify-center px-4">
        <div className="w-full max-w-5xl rounded-[36px] border border-white/40 bg-white/70 px-12 py-14 md:px-16 md:py-16 text-center backdrop-blur-2xl shadow-[0_30px_90px_-55px_rgba(93,141,244,0.55)]">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5d8df4]">
              질문 {currentQuestion + 1}
            </p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-900 break-keep md:text-4xl">
              {currentQuestionSafe}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              마이크 버튼을 눌러 답변을 말씀해주세요.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-5">
            <button
              disabled={micButtonDisabled}
              onClick={recording ? stopRecording : startRecording}
              className={`group relative h-32 w-32 rounded-full text-white shadow-[0_22px_70px_-35px_rgba(93,141,244,0.9)] transition-all duration-200 ${
                recording
                  ? "bg-gradient-to-br from-[#ff6b6b] to-[#ff9671]"
                  : "bg-[#5d8df4]"
              } disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none`}
              aria-label={recording ? "녹음 정지" : "녹음 시작"}
            >
              <span
                className="absolute inset-[-14px] rounded-full bg-[#5d8df4]/18 blur-2xl"
                aria-hidden
              />
              <div className="relative flex h-full w-full items-center justify-center rounded-full">
                <Mic className="h-12 w-12" />
              </div>
            </button>
            <p className="text-sm font-semibold text-slate-700">
              {voiceStatus === "speaking"
                ? "질문 읽는 중..."
                : transcribing
                ? "음성 인식 중..."
                : recording
                ? "녹음 중 · 눌러서 정지"
                : "버튼을 눌러 녹음을 시작하세요"}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={speakCurrentQuestion}
                icon={<Volume2 className="h-4 w-4" />}
              >
                질문 다시 듣기
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const ResultProfile = () => (
    <Card className="glass border-white/60 shadow-2xl">
      <div className="rounded-2xl bg-gradient-to-br from-[#5d8df4] via-[#6f9af6] to-[#4b7ae0] p-6 text-white shadow-lg">
        <p className="text-sm opacity-80">프로필 요약</p>
        <p className="mt-2 text-xl font-bold leading-snug break-keep">
          {profile ? profile.persona_summary : "프로필을 생성하는 중입니다..."}
        </p>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
        {[
          { label: "이전 경력", value: profile?.previous_job },
          { label: "주요 스킬", value: profile?.skills?.join(", ") },
          {
            label: "활동/자세",
            value: profile
              ? `${profile.activity_level} · ${profile.work_posture}`
              : undefined,
          },
          {
            label: "희망 근무",
            value: profile
              ? `주 ${profile.weekly_work_days}일 · ${profile.salary_expectation}`
              : undefined,
          },
          {
            label: "성향",
            value: profile
              ? `${profile.social_preference} · ${profile.learning_preference}`
              : undefined,
          },
          { label: "디지털", value: profile?.digital_literacy },
          { label: "동기", value: profile?.motivation },
        ].map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[110px_1fr] items-start gap-2 rounded-xl bg-white/70 px-3 py-2"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {row.label}
            </span>
            <span className="text-slate-900">
              {row.value || (loadingProfile ? "불러오는 중..." : "-")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );

  const ResultsView = () => (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5d8df4]">
            인터뷰 완료
          </p>
          <h2 className="text-3xl font-bold text-slate-900">
            맞춤 프로필과 추천이 준비되었습니다.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            생성형 AI가 프로필을 만들고, 데이터 기반으로 일자리·정책·교육을
            추천합니다.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsSmsModalOpen(true)} // 클릭 시 모달 열기
          // disabled={!recommendations} // 필요하다면 이 disabled 로직을 다시 활성화할 수 있습니다.
        >
          채용 공고 문자 받기
        </Button>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[360px_1fr]">
        <ResultProfile />

        <div className="space-y-6">
          <Card className="glass border-white/60 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">일자리 Top 3</h3>
              {recommendations?.source && (
                <Badge variant="primary" size="sm">
                  {recommendations.source === "rag" ? "RAG 기반" : "규칙 기반"}
                </Badge>
              )}
            </div>
            {recommendations ? (
              <div className="space-y-4">
                {recommendations.jobRecommendations.map((rec, idx) => (
                  <div
                    key={rec.job.id}
                    className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            idx === 0
                              ? "bg-[#5d8df4]/15 text-[#2f4fa8]"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {idx + 1}순위
                        </span>
                        <p className="text-lg font-bold text-slate-900 break-keep">
                          {rec.job.title}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        적합도 {(rec.score ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {rec.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {rec.job.region}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        주 {rec.job.work_days}일
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {rec.job.activity_level}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {rec.job.posture}
                      </span>
                      <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[#2f4fa8]">
                        급여 {formatSalary(rec.job)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                추천을 준비하는 중입니다...
              </p>
            )}
          </Card>

          <Card className="glass border-white/60 shadow-lg">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    정책 추천
                  </Badge>
                  <p className="text-sm text-slate-600">지원금·혜택</p>
                </div>
                {recommendations ? (
                  <div className="space-y-3">
                    {recommendations.policies.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
                      >
                        <p className="font-bold text-slate-900 break-keep">
                          {p.title}
                        </p>
                        <p className="text-sm text-slate-700">{p.benefit}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          대상 {p.target_age} · 지역 {p.region}
                        </p>
                      </div>
                    ))}
                    {!recommendations.policies.length && (
                      <p className="text-sm text-slate-500">
                        해당 조건에 맞는 정책을 찾지 못했습니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    정책 추천을 불러오는 중입니다...
                  </p>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    교육 추천
                  </Badge>
                  <p className="text-sm text-slate-600">업스킬·리스킬</p>
                </div>
                {recommendations ? (
                  <div className="space-y-3">
                    {recommendations.educations.map((e) => (
                      <div
                        key={e.id}
                        className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
                      >
                        <p className="font-bold text-slate-900 break-keep">
                          {e.title}
                        </p>
                        <p className="text-sm text-slate-700">{e.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.region} · {e.mode} · {e.duration} · {e.cost || ""}
                        </p>
                      </div>
                    ))}
                    {!recommendations.educations.length && (
                      <p className="text-sm text-slate-500">
                        조건에 맞는 교육을 찾지 못했습니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    교육 추천을 불러오는 중입니다...
                  </p>
                )}
              </div>
            </div>
          </Card>

          {recommendations?.ragJobRecommendations &&
          recommendations.ragJobRecommendations.length > 0 ? (
            <Card className="glass border-white/60 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  벡터 기반 프로그램 추천
                </h3>
                <Badge variant="primary" size="sm">
                  RAG
                </Badge>
              </div>
              <div className="space-y-3">
                {recommendations.ragJobRecommendations.map((rec, idx) => (
                  <div
                    key={rec.program.id}
                    className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#2f4fa8]">
                        {idx + 1}순위
                      </span>
                      <p className="text-sm text-slate-500">
                        {rec.program.type}
                      </p>
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-900 break-keep">
                      {rec.program.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{rec.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rec.program.region}
                      {rec.program.benefits && ` · ${rec.program.benefits}`}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      {/* --- SMS 팝업(모달) UI 시작 --- */}
      {isSmsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass relative w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              채용 공고 문자 받기
            </h2>
            <p className="text-slate-600 mb-6">
              전화번호를 입력하시면, 새로운 채용 공고가 등록될 때 문자로 알려드립니다.
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="phone-input" className="text-sm font-semibold text-slate-700">
                  전화번호 작성
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  placeholder="'-' 없이 숫자만 입력"
                  className="mt-2 w-full rounded-xl border border-white/70 bg-white/90 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#5d8df4] focus:outline-none focus:ring-2 focus:ring-[#5d8df4]/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    alert("채용 공고가 올라오면 문자 드리겠습니다!");
                    setIsSmsModalOpen(false);
                  }}
                >
                  문자 받기!
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsSmsModalOpen(false)}
                >
                  취소
                </Button>
              </div>
            </div>
            
            {/* 닫기 버튼 */}
            <button 
              onClick={() => setIsSmsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-slate-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}
      {/* --- SMS 팝업(모달) UI 끝 --- */}
      
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 -top-32 h-96 w-96 rounded-full bg-[#5d8df4]/14 blur-[120px]" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-white/50 blur-[110px]" />
      </div>

      <header className="sticky top-0 z-20 bg-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="cursor-pointer">
              <p className="text-xs font-semibold text-slate-500">
                시니어 커리어 내비게이션
              </p>
              <p className="text-2xl font-bold uppercase tracking-tight text-[#5d8df4]">
                Reborn
              </p>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#5d8df4]/90 shadow-[0_0_0_4px_rgba(93,141,244,0.15)]" />
              <span>
                {statusMsg ||
                  (started
                    ? "질문을 진행 중입니다."
                    : "마이크 권한을 허용하고 시작하세요.")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-white/40 shadow-inner">
                <div
                  className="h-full rounded-full bg-[#5d8df4]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-4">
        {!started ? (
          <LandingView />
        ) : showResults ? (
          <ResultsView />
        ) : (
          <InterviewView />
        )}
      </main>
    </div>
  );
}
