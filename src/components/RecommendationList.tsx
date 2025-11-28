"use client";

import type {
  RecommendationResponse,
  JobRecommendation,
  ProgramRecommendation,
} from "@/types/domain";

const listContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const itemStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E2E2E2",
  borderRadius: "var(--border-radius)",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: "600",
  marginBottom: "8px",
};

const descriptionStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "var(--text-secondary-color)",
  marginBottom: "12px",
};

const tagContainerStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const tagStyle: React.CSSProperties = {
  backgroundColor: "#E2E2E2",
  color: "var(--text-color)",
  padding: "4px 10px",
  borderRadius: "16px",
  fontSize: "0.8rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: "600",
  marginBottom: "16px",
  paddingBottom: "8px",
  borderBottom: "2px solid var(--primary-color)",
};

interface RecommendationListProps {
  recommendations: RecommendationResponse;
}

const RecommendationItem = ({
  title,
  description,
  tags,
}: {
  title: string;
  description: string;
  tags?: string[];
}) => (
  <div style={itemStyle}>
    <h3 style={titleStyle}>{title}</h3>
    <p style={descriptionStyle}>{description}</p>
    {tags && tags.length > 0 && (
      <div style={tagContainerStyle}>
        {tags.map((tag) => (
          <span key={tag} style={tagStyle}>
            {tag}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default function RecommendationList({
  recommendations,
}: RecommendationListProps) {
  // jobRecommendations를 ProgramRecommendation으로 변환
  const jobPrograms: ProgramRecommendation[] = (
    recommendations.jobRecommendations || []
  ).map((rec) => ({
    program: {
      id: rec.job.id,
      title: rec.job.title,
      type: "job",
      region: rec.job.region,
      description: rec.job.description,
      tags: rec.job.tags,
      deadline: rec.job.deadline,
    } as any,
    score: rec.score,
    reason: rec.reason,
  }));

  // policies를 ProgramRecommendation으로 변환
  const policyPrograms: ProgramRecommendation[] = (
    recommendations.policies || []
  ).map((p) => ({
    program: {
      id: p.id,
      title: p.title,
      type: "policy",
      region: p.region,
      description: p.description,
      tags: p.tags,
      target_age: p.target_age,
    } as any,
    score: 0.8, // 정책은 score가 없으므로 기본값
    reason: p.benefit || "",
  }));

  // educations를 ProgramRecommendation으로 변환
  const educationPrograms: ProgramRecommendation[] = (
    recommendations.educations || []
  ).map((e) => ({
    program: {
      id: e.id,
      title: e.title,
      type: "education",
      region: e.region,
      description: e.summary,
      tags: e.tags,
      provider: e.provider,
    } as any,
    score: 0.7, // 교육도 score가 없으므로 기본값
    reason: e.summary || "",
  }));

  const allRecs = [
    ...jobPrograms,
    ...policyPrograms,
    ...educationPrograms,
  ].sort((a, b) => b.score - a.score);

  // 태그 생성 함수 - tags가 없거나 적을 때 다른 정보로 보완
  const generateTags = (rec: ProgramRecommendation): string[] => {
    const tags: string[] = [];

    // type을 한글로 변환
    const typeTag =
      rec.program.type === "job"
        ? "일자리"
        : rec.program.type === "policy"
        ? "정책"
        : "교육";
    tags.push(typeTag);

    // 원본 tags 추가
    if (rec.program.tags && rec.program.tags.length > 0) {
      tags.push(...rec.program.tags);
    }

    // tags가 2개 미만이면 추가 정보로 보완
    if (tags.length < 3) {
      // 지역 정보 추가
      if (rec.program.region) {
        tags.push(rec.program.region);
      }

      // provider 정보 추가
      if (rec.program.provider) {
        tags.push(rec.program.provider);
      }
    }

    return tags;
  };

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: "600",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        맞춤 추천 목록
      </h2>

      {allRecs.length > 0 ? (
        <div style={listContainerStyle}>
          {allRecs.map((rec) => (
            <RecommendationItem
              key={rec.program.id}
              title={rec.program.title}
              description={rec.reason}
              tags={generateTags(rec)}
            />
          ))}
        </div>
      ) : (
        <p
          style={{ textAlign: "center", color: "var(--text-secondary-color)" }}
        >
          추천 항목을 찾지 못했습니다.
        </p>
      )}
    </div>
  );
}
