"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgramItem } from "@/types/domain";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { ArrowLeft, Search } from "lucide-react";

type FilterType = "all" | "job" | "policy" | "education";

export default function BrowsePage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPrograms(data.programs || []);
    } catch (error) {
      console.error("프로그램 불러오기 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter((program) => {
    const matchesFilter =
      filter === "all" || program.type === filter;
    const matchesSearch =
      searchQuery === "" ||
      program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.region.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "job":
        return "일자리";
      case "policy":
        return "정책";
      case "education":
        return "교육";
      default:
        return type;
    }
  };

  const getTypeBadgeVariant = (type: string): "primary" | "secondary" => {
    return type === "job" ? "primary" : "secondary";
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
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
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            전체 공고 둘러보기
          </h1>
          <p className="text-slate-600">
            일자리, 정책, 교육 프로그램을 한눈에 확인하세요.
          </p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="제목, 설명, 지역으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/80 pl-12 pr-4 py-3 text-slate-900 placeholder-slate-400 backdrop-blur-sm focus:border-[#5d8df4] focus:outline-none focus:ring-2 focus:ring-[#5d8df4]/20"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              { value: "all", label: "전체" },
              { value: "job", label: "일자리" },
              { value: "policy", label: "정책" },
              { value: "education", label: "교육" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as FilterType)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  filter === tab.value
                    ? "bg-[#5d8df4] text-white shadow-lg"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">프로그램을 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-slate-600">
              총 <span className="font-semibold text-[#5d8df4]">{filteredPrograms.length}</span>개 프로그램
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((program) => (
                <Card
                  key={program.id}
                  className="glass border-white/60 shadow-lg hover:shadow-xl transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Badge
                      variant={getTypeBadgeVariant(program.type)}
                      size="sm"
                    >
                      {getTypeLabel(program.type)}
                    </Badge>
                    <span className="text-xs text-slate-500">{program.region}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 break-keep">
                    {program.title}
                  </h3>

                  {program.description && (
                    <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                      {program.description}
                    </p>
                  )}

                  <div className="space-y-2 text-xs text-slate-600">
                    {program.benefits && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">혜택:</span>{" "}
                        {program.benefits}
                      </div>
                    )}

                    {program.duration && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">기간:</span>{" "}
                        {program.duration}
                      </div>
                    )}

                    {program.cost && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">비용:</span>{" "}
                        {program.cost}
                      </div>
                    )}

                    {program.deadline && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">마감:</span>{" "}
                        {program.deadline}
                      </div>
                    )}

                    {program.target_age && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">대상:</span>{" "}
                        {program.target_age}
                      </div>
                    )}

                    {program.provider && (
                      <div className="rounded-xl bg-white/70 px-3 py-2">
                        <span className="font-semibold text-slate-500">제공:</span>{" "}
                        {program.provider}
                      </div>
                    )}
                  </div>

                  {program.tags && program.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {program.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {program.link && (
                    <div className="mt-4">
                      <a
                        href={program.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#5d8df4] hover:underline"
                      >
                        자세히 보기 →
                      </a>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {filteredPrograms.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500">검색 결과가 없습니다.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
