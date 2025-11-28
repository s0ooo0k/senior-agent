'use client';

import type { RecommendationResponse, JobRecommendation, ProgramRecommendation } from '@/types/domain';

const listContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
};

const itemStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E2E2',
    borderRadius: 'var(--border-radius)',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};

const titleStyle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '8px',
};

const descriptionStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'var(--text-secondary-color)',
    marginBottom: '12px',
};

const tagContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
};

const tagStyle: React.CSSProperties = {
    backgroundColor: '#E2E2E2',
    color: 'var(--text-color)',
    padding: '4px 10px',
    borderRadius: '16px',
    fontSize: '0.8rem',
};

const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.3rem',
    fontWeight: '600',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '2px solid var(--primary-color)',
};

interface RecommendationListProps {
    recommendations: RecommendationResponse;
}

const RecommendationItem = ({ title, description, tags }: { title: string, description: string, tags?: string[] }) => (
    <div style={itemStyle}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={descriptionStyle}>{description}</p>
        {tags && tags.length > 0 && (
            <div style={tagContainerStyle}>
                {tags.map(tag => (
                    <span key={tag} style={tagStyle}>{tag}</span>
                ))}
            </div>
        )}
    </div>
);

export default function RecommendationList({ recommendations }: RecommendationListProps) {
    const { ragJobRecommendations, ragPolicyRecommendations, ragEducationRecommendations } = recommendations;

    const allRecs = [
        ...(ragJobRecommendations || []),
        ...(ragPolicyRecommendations || []),
        ...(ragEducationRecommendations || []),
    ].sort((a, b) => b.score - a.score);

    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '24px', textAlign: 'center' }}>맞춤 추천 목록</h2>
            
            {allRecs.length > 0 ? (
                <div style={listContainerStyle}>
                    {allRecs.map((rec) => (
                        <RecommendationItem 
                            key={rec.program.id}
                            title={rec.program.title}
                            description={rec.reason}
                            tags={[rec.program.type, ...(rec.program.tags || [])]}
                        />
                    ))}
                </div>
            ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary-color)' }}>추천 항목을 찾지 못했습니다.</p>
            )}
        </div>
    );
}
