'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ParsedFileEntry = {
  file: string;
  size: number;
  modified: string;
  content: unknown;
};

export default function AdminDataPage() {
  const [parsedFiles, setParsedFiles] = useState<ParsedFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileMessage, setFileMessage] = useState('');
  const [embeddingStatic, setEmbeddingStatic] = useState(false);
  const [staticMessage, setStaticMessage] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      sizes.length - 1
    );
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const fetchParsedFiles = async () => {
    setFilesLoading(true);
    setFileMessage('');
    try {
      const res = await fetch('/api/parsed-files');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '불러오기 실패');
      }
      setParsedFiles(data.files || []);
      if (!data.files?.length) {
        setFileMessage('현재 parsed 디렉토리에 저장된 JSON이 없습니다.');
      }
    } catch (error) {
      console.error(error);
      setFileMessage(
        error instanceof Error ? error.message : '파일을 불러오지 못했습니다.'
      );
    } finally {
      setFilesLoading(false);
    }
  };

  const handleDeleteFile = async (file: string) => {
    const ok = window.confirm(`정말로 ${file} 파일을 삭제할까요?`);
    if (!ok) return;

    setFileMessage('삭제 중...');
    try {
      const res = await fetch(`/api/parsed-files?file=${encodeURIComponent(file)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '삭제 실패');
      }
      setFileMessage('삭제 완료!');
      await fetchParsedFiles();
    } catch (error) {
      console.error(error);
      setFileMessage(
        error instanceof Error ? error.message : '파일 삭제에 실패했습니다.'
      );
    }
  };

  const handleEmbedStaticData = async () => {
    setEmbeddingStatic(true);
    setStaticMessage('기본 + 파싱 데이터 임베딩 중...');

    try {
      const res = await fetch('/api/embed-static-data', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '임베딩 실패');
      }

      setStaticMessage(
        `✅ ${data.success}개 프로그램 저장 완료! (일자리: ${data.breakdown.jobs}, 정책: ${data.breakdown.policies}, 교육: ${data.breakdown.educations}, 파싱: ${data.breakdown.parsed})`
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

  useEffect(() => {
    fetchParsedFiles();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-600">
              Admin Data
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl text-slate-800">
              파싱된 JSON 관리 & Qdrant 저장
            </h1>
            <p className="max-w-3xl text-lg text-slate-700 leading-relaxed">
              기본 JSON 데이터와 파싱된 프로그램 JSON을 확인하고, Qdrant에 한 번에 저장할 수 있습니다.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            PDF 파싱 페이지
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold text-slate-800 mb-4">기존 + 파싱 데이터 Qdrant 저장</h2>
          <p className="mb-6 text-sm text-slate-600 leading-relaxed">
            jobs.json, policies.json, educations.json 기본 데이터와 src/data/parsed 폴더의 JSON을 함께 임베딩하여 Qdrant에 저장합니다.
          </p>

          <button
            onClick={handleEmbedStaticData}
            disabled={embeddingStatic}
            className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {embeddingStatic ? '임베딩 중...' : 'Qdrant에 저장'}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">파싱된 JSON 관리</h2>
              <p className="text-sm text-slate-600">
                src/data/parsed 폴더에 저장된 파싱 결과를 확인하고 삭제할 수 있습니다.
              </p>
            </div>
            <button
              onClick={fetchParsedFiles}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
            >
              새로고침
            </button>
          </div>

          {fileMessage && (
            <div
              className={`mt-4 rounded-xl p-3 text-sm ${
                fileMessage.includes('실패') || fileMessage.includes('없습니다')
                  ? 'bg-slate-100 text-slate-700'
                  : fileMessage.includes('삭제')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {fileMessage}
            </div>
          )}

          {filesLoading ? (
            <div className="mt-4 flex items-center gap-2 text-slate-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
              <span className="text-sm font-medium">불러오는 중...</span>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {parsedFiles.map((entry) => {
                const contentObject =
                  entry.content &&
                  typeof entry.content === 'object' &&
                  !Array.isArray(entry.content)
                    ? (entry.content as {
                        filename?: unknown;
                        timestamp?: unknown;
                        programs?: unknown;
                      })
                    : null;

                const programCount =
                  Array.isArray(entry.content) && !Array.isArray(contentObject?.programs)
                    ? entry.content.length
                    : contentObject && Array.isArray(contentObject.programs)
                    ? contentObject.programs.length
                    : 0;

                const filename =
                  contentObject && typeof contentObject.filename === 'string'
                    ? contentObject.filename
                    : '-';

                const parsedAt =
                  contentObject && typeof contentObject.timestamp === 'string'
                    ? contentObject.timestamp
                    : undefined;

                return (
                  <div
                    key={entry.file}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-600">파일명</p>
                        <p className="font-mono text-sm text-slate-800 break-all">
                          {entry.file}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {new Date(entry.modified).toLocaleString('ko-KR')}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {formatBytes(entry.size)}
                        </span>
                        <button
                          onClick={() => handleDeleteFile(entry.file)}
                          className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-600">원본 파일</p>
                        <p className="text-sm text-slate-800">{filename}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-600">파싱 시간</p>
                        <p className="text-sm text-slate-800">
                          {parsedAt
                            ? new Date(parsedAt).toLocaleString('ko-KR')
                            : '-'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-600">프로그램 수</p>
                        <p className="text-sm text-slate-800">{programCount}개</p>
                      </div>
                    </div>

                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                        내용 펼치기
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(entry.content, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })}

              {!parsedFiles.length && !fileMessage && (
                <p className="text-sm text-slate-600">
                  현재 parsed 디렉토리에 저장된 파일이 없습니다.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
