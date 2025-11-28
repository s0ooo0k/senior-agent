'use client';

import { useState } from 'react';
import type { ProgramItem } from '@/types/domain';

type ParsedData = {
  filename: string;
  timestamp: string;
  programs: ProgramItem[];
  savedTo: string;
};

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setMessage('PDF 파싱 중...');
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PDF 파싱 실패');
      }

      setParsedData(data);
      setMessage('PDF 파싱 및 저장 완료!');
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : 'PDF 파싱에 실패했습니다.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">
            Admin Panel
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            PDF 문서 업로드 및 파싱
          </h1>
          <p className="max-w-3xl text-lg text-slate-200/80">
            PDF 파일을 업로드하면 Upstage Document Parser를 통해 자동으로 파싱하여
            JSON 형식으로 저장합니다.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <h2 className="text-xl font-semibold mb-4">PDF 파일 업로드</h2>

          <div className="flex flex-col gap-4">
            <label
              htmlFor="pdf-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition hover:border-emerald-300/60 hover:bg-white/10"
            >
              <svg
                className="h-12 w-12 text-emerald-300/80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mt-2 text-sm text-slate-200">
                클릭하여 PDF 파일 선택
              </p>
              <p className="text-xs text-slate-400">PDF 파일만 업로드 가능합니다</p>
            </label>

            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />

            {message && (
              <div
                className={`rounded-xl p-4 ${
                  message.includes('실패') || message.includes('실패')
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'bg-emerald-500/20 text-emerald-200'
                }`}
              >
                <p className="text-sm">{message}</p>
              </div>
            )}

            {uploading && (
              <div className="flex items-center justify-center gap-2 text-emerald-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent"></div>
                <span className="text-sm">처리 중...</span>
              </div>
            )}
          </div>
        </section>

        {parsedData && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <h2 className="text-xl font-semibold mb-4">추출된 프로그램</h2>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-black/30 p-4">
                  <p className="text-sm text-emerald-200/70">파일명</p>
                  <p className="mt-1 font-mono text-sm">{parsedData.filename}</p>
                </div>

                <div className="rounded-xl bg-black/30 p-4">
                  <p className="text-sm text-emerald-200/70">저장 시간</p>
                  <p className="mt-1 font-mono text-sm">
                    {new Date(parsedData.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-black/30 p-4">
                <p className="text-sm text-emerald-200/70 mb-2">
                  총 {parsedData.programs.length}개 프로그램 발견
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  저장 위치: src/data/parsed/{parsedData.savedTo}
                </p>
              </div>

              <div className="space-y-3">
                {parsedData.programs.map((program, idx) => (
                  <div
                    key={program.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                            {program.type}
                          </span>
                          <span className="text-xs text-slate-400">#{idx + 1}</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          {program.title}
                        </h3>
                        <p className="text-sm text-slate-200/80 mb-3">
                          {program.description}
                        </p>

                        <div className="grid gap-2 text-sm">
                          {program.region && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">지역:</span>
                              <span>{program.region}</span>
                            </div>
                          )}
                          {program.target_age && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">대상:</span>
                              <span>{program.target_age}</span>
                            </div>
                          )}
                          {program.benefits && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">혜택:</span>
                              <span>{program.benefits}</span>
                            </div>
                          )}
                          {program.duration && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">기간:</span>
                              <span>{program.duration}</span>
                            </div>
                          )}
                          {program.deadline && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">마감:</span>
                              <span>{program.deadline}</span>
                            </div>
                          )}
                          {program.cost && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">비용:</span>
                              <span>{program.cost}</span>
                            </div>
                          )}
                          {program.provider && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">제공:</span>
                              <span>{program.provider}</span>
                            </div>
                          )}
                          {program.contact && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">연락처:</span>
                              <span>{program.contact}</span>
                            </div>
                          )}
                          {program.link && (
                            <div className="flex gap-2">
                              <span className="text-emerald-200/70 w-20">링크:</span>
                              <a
                                href={program.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-300 hover:underline"
                              >
                                바로가기
                              </a>
                            </div>
                          )}
                          {program.tags && program.tags.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              <span className="text-emerald-200/70 w-20">태그:</span>
                              <div className="flex flex-wrap gap-1">
                                {program.tags.map((tag, tagIdx) => (
                                  <span
                                    key={tagIdx}
                                    className="rounded-full bg-white/10 px-2 py-0.5 text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <details className="rounded-xl bg-black/30 p-4">
                <summary className="cursor-pointer text-sm text-emerald-200/70">
                  원본 JSON 보기
                </summary>
                <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
                  {JSON.stringify(parsedData.programs, null, 2)}
                </pre>
              </details>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
