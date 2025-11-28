'use client';

import { useState } from 'react';
import type { ProgramItem } from '@/types/domain';

type ParsedData = {
  filename: string;
  timestamp: string;
  programs: ProgramItem[];
  savedTo: string;
  qdrant?: {
    total: number;
    success: number;
    failed: number;
  };
};

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [embeddingMessage, setEmbeddingMessage] = useState('');
  const [embeddingStatic, setEmbeddingStatic] = useState(false);
  const [staticMessage, setStaticMessage] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setMessage('PDF 파싱 및 임베딩 중... (시간이 걸릴 수 있습니다)');
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
      if (data.qdrant) {
        setMessage(
          `PDF 파싱 및 Qdrant 저장 완료! (${data.qdrant.success}/${data.qdrant.total}개 임베딩됨)`
        );
      } else {
        setMessage('PDF 파싱 및 저장 완료!');
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : 'PDF 파싱에 실패했습니다.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleEmbedPrograms = async () => {
    if (!parsedData || !parsedData.programs) return;

    setEmbedding(true);
    setEmbeddingMessage('프로그램 임베딩 및 Qdrant 저장 중...');

    try {
      const res = await fetch('/api/embed-programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ programs: parsedData.programs }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '임베딩 실패');
      }

      setEmbeddingMessage(
        `✅ ${data.success}개 프로그램이 Qdrant에 저장되었습니다!`
      );
    } catch (error) {
      console.error(error);
      setEmbeddingMessage(
        error instanceof Error
          ? `❌ ${error.message}`
          : '❌ 임베딩에 실패했습니다.'
      );
    } finally {
      setEmbedding(false);
    }
  };

  const handleEmbedStaticData = async () => {
    setEmbeddingStatic(true);
    setStaticMessage('기존 데이터 임베딩 중...');

    try {
      const res = await fetch('/api/embed-static-data', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '임베딩 실패');
      }

      setStaticMessage(
        `✅ ${data.success}개 프로그램 저장 완료! (일자리: ${data.breakdown.jobs}, 정책: ${data.breakdown.policies}, 교육: ${data.breakdown.educations})`
      );
    } catch (error) {
      console.error(error);
      setStaticMessage(
        error instanceof Error
          ? `❌ ${error.message}`
          : '❌ 임베딩에 실패했습니다.'
      );
    } finally {
      setEmbeddingStatic(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.35em] text-blue-600">
            Admin Panel
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl text-slate-800">
            PDF 문서 업로드 및 파싱
          </h1>
          <p className="max-w-3xl text-lg text-slate-700 leading-relaxed">
            PDF 파일을 업로드하면 Upstage Document Parser를 통해 자동으로 파싱하여
            JSON 형식으로 저장합니다.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold text-slate-800 mb-4">기존 데이터 Qdrant 저장</h2>
          <p className="mb-6 text-sm text-slate-600 leading-relaxed">
            jobs.json, policies.json, educations.json 파일의 데이터를 Qdrant에
            임베딩하여 저장합니다.
          </p>

          <button
            onClick={handleEmbedStaticData}
            disabled={embeddingStatic}
            className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {embeddingStatic ? '임베딩 중...' : '기존 데이터 Qdrant에 저장'}
          </button>

          {staticMessage && (
            <div
              className={`mt-4 rounded-xl p-4 ${
                staticMessage.includes('❌')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              <p className="text-sm font-medium">{staticMessage}</p>
            </div>
          )}

          {embeddingStatic && (
            <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm font-medium">처리 중...</span>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold text-slate-800 mb-4">PDF 파일 업로드</h2>

          <div className="flex flex-col gap-4">
            <label
              htmlFor="pdf-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition hover:border-blue-500 hover:bg-blue-50"
            >
              <svg
                className="h-12 w-12 text-blue-600"
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
              <p className="mt-2 text-sm font-medium text-slate-700">
                클릭하여 PDF 파일 선택
              </p>
              <p className="text-xs text-slate-500">PDF 파일만 업로드 가능합니다</p>
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
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {uploading && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-sm font-medium">처리 중...</span>
              </div>
            )}
          </div>
        </section>

        {parsedData && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">추출된 프로그램</h2>
            </div>

            {/* Qdrant 자동 저장 결과 */}
            {parsedData.qdrant && (
              <div className="mb-4 rounded-xl bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-5 w-5 text-emerald-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-emerald-200">
                    Qdrant 자동 저장 완료
                  </p>
                </div>
                <p className="text-sm text-emerald-100">
                  {parsedData.qdrant.success}개 프로그램이 벡터 DB에 저장되었습니다
                  {parsedData.qdrant.failed > 0 &&
                    ` (실패: ${parsedData.qdrant.failed}개)`}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-sm font-medium text-slate-600">파일명</p>
                  <p className="mt-1 font-mono text-sm text-slate-800">{parsedData.filename}</p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-sm font-medium text-slate-600">저장 시간</p>
                  <p className="mt-1 font-mono text-sm text-slate-800">
                    {new Date(parsedData.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm font-bold text-blue-700 mb-2">
                  총 {parsedData.programs.length}개 프로그램 발견
                </p>
                <p className="text-xs text-slate-600 font-mono">
                  저장 위치: src/data/parsed/{parsedData.savedTo}
                </p>
              </div>

              <div className="space-y-3">
                {parsedData.programs.map((program, idx) => (
                  <div
                    key={program.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            {program.type}
                          </span>
                          <span className="text-xs text-slate-500">#{idx + 1}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 break-keep">
                          {program.title}
                        </h3>
                        <p className="text-sm text-slate-700 mb-3 leading-relaxed break-keep">
                          {program.description}
                        </p>

                        <div className="grid gap-2 text-sm">
                          {program.region && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">지역:</span>
                              <span className="text-slate-700">{program.region}</span>
                            </div>
                          )}
                          {program.target_age && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">대상:</span>
                              <span className="text-slate-700">{program.target_age}</span>
                            </div>
                          )}
                          {program.benefits && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">혜택:</span>
                              <span className="text-slate-700">{program.benefits}</span>
                            </div>
                          )}
                          {program.duration && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">기간:</span>
                              <span className="text-slate-700">{program.duration}</span>
                            </div>
                          )}
                          {program.deadline && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">마감:</span>
                              <span className="text-slate-700">{program.deadline}</span>
                            </div>
                          )}
                          {program.cost && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">비용:</span>
                              <span className="text-slate-700">{program.cost}</span>
                            </div>
                          )}
                          {program.provider && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">제공:</span>
                              <span className="text-slate-700">{program.provider}</span>
                            </div>
                          )}
                          {program.contact && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">연락처:</span>
                              <span className="text-slate-700">{program.contact}</span>
                            </div>
                          )}
                          {program.link && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-600 w-20">링크:</span>
                              <a
                                href={program.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                              >
                                바로가기
                              </a>
                            </div>
                          )}
                          {program.tags && program.tags.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              <span className="font-medium text-slate-600 w-20">태그:</span>
                              <div className="flex flex-wrap gap-1">
                                {program.tags.map((tag, tagIdx) => (
                                  <span
                                    key={tagIdx}
                                    className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs font-medium"
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

              <details className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                  원본 JSON 보기
                </summary>
                <pre className="mt-3 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
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
