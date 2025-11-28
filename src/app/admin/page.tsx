'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProgramItem } from '@/types/domain';

type ParsedData = {
  filename: string;
  timestamp: string;
  programs: ProgramItem[];
  savedTo: string;
  markdown?: string;
  message?: string;
};

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [editedPrograms, setEditedPrograms] = useState<ProgramItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [showMarkdown, setShowMarkdown] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setMessage('PDF 파싱 중... (시간이 걸릴 수 있습니다)');
    setParsedData(null);
    setConfirmMessage('');

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
      setEditedPrograms(data.programs || []);
      setMessage(data.message || 'PDF 파싱 완료! 내용을 확인하고 저장하세요.');
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : 'PDF 파싱에 실패했습니다.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!editedPrograms || editedPrograms.length === 0) return;

    setConfirming(true);
    setConfirmMessage('Qdrant에 저장 중...');

    try {
      const res = await fetch('/api/confirm-programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ programs: editedPrograms }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Qdrant 저장 실패');
      }

      setConfirmMessage(
        `✅ ${data.success}/${data.total}개 프로그램이 Qdrant에 저장되었습니다!`
      );
    } catch (error) {
      console.error(error);
      setConfirmMessage(
        error instanceof Error
          ? `❌ ${error.message}`
          : '❌ Qdrant 저장에 실패했습니다.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleProgramEdit = <K extends keyof ProgramItem>(
    index: number,
    field: K,
    value: ProgramItem[K]
  ) => {
    setEditedPrograms((prev) =>
      prev.map((program, idx) =>
        idx === index ? { ...program, [field]: value } : program
      )
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-600">
              Admin Panel
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl text-slate-800">
              PDF 문서 업로드 및 파싱
            </h1>
            <p className="max-w-3xl text-lg text-slate-700 leading-relaxed">
              PDF 파일을 업로드하면 Upstage Document Parser를 통해 자동으로 파싱합니다.
              파싱된 내용을 확인하고 수정한 후 Qdrant에 저장할 수 있습니다.
            </p>
          </div>

          <Link
            href="/admin-data"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            데이터 관리 페이지
          </Link>
        </header>

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
                  message.includes('실패')
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
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
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">파싱 결과 확인</h2>
              <button
                onClick={() => setShowMarkdown(!showMarkdown)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                {showMarkdown ? '마크다운 숨기기' : '원본 마크다운 보기'}
              </button>
            </div>

            {showMarkdown && parsedData.markdown && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-3">PDF → 마크다운 변환 결과</h3>
                <div className="max-h-96 overflow-auto rounded-xl bg-white p-4 border border-slate-200">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                    {parsedData.markdown}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-sm font-medium text-slate-600">파일명</p>
                  <p className="mt-1 font-mono text-sm text-slate-800">
                    {parsedData.filename}
                  </p>
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
                  총 {editedPrograms.length}개 프로그램 발견
                </p>
                <p className="text-xs text-slate-600 font-mono">
                  저장 위치: src/data/parsed/{parsedData.savedTo}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                프로그램 상세 (수정 가능)
              </h3>
              {editedPrograms.map((program, idx) => (
                <div
                  key={program.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                      {program.type}
                    </span>
                    <span className="text-xs text-slate-500">#{idx + 1}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        제목
                      </label>
                      <input
                        type="text"
                        value={program.title}
                        onChange={(e) => handleProgramEdit(idx, 'title', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        설명
                      </label>
                      <textarea
                        value={program.description || ''}
                        onChange={(e) => handleProgramEdit(idx, 'description', e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          지역
                        </label>
                        <input
                          type="text"
                          value={program.region}
                          onChange={(e) => handleProgramEdit(idx, 'region', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          대상 연령
                        </label>
                        <input
                          type="text"
                          value={program.target_age || ''}
                          onChange={(e) => handleProgramEdit(idx, 'target_age', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          혜택
                        </label>
                        <input
                          type="text"
                          value={program.benefits || ''}
                          onChange={(e) => handleProgramEdit(idx, 'benefits', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          기간
                        </label>
                        <input
                          type="text"
                          value={program.duration || ''}
                          onChange={(e) => handleProgramEdit(idx, 'duration', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          비용
                        </label>
                        <input
                          type="text"
                          value={program.cost || ''}
                          onChange={(e) => handleProgramEdit(idx, 'cost', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          제공 기관
                        </label>
                        <input
                          type="text"
                          value={program.provider || ''}
                          onChange={(e) => handleProgramEdit(idx, 'provider', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-6 flex flex-col gap-3">
              <button
                onClick={handleConfirmAndSave}
                disabled={confirming}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-lg font-bold text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? '저장 중...' : '✓ 확인 및 Qdrant에 저장'}
              </button>

              {confirmMessage && (
                <div
                  className={`rounded-xl p-4 ${
                    confirmMessage.includes('❌')
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  <p className="text-sm font-medium">{confirmMessage}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
