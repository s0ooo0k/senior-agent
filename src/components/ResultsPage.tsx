'use client';

import type { SeniorProfile, RecommendationResponse } from '@/types/domain';
import ProfileCard from './ProfileCard';
import RecommendationList from './RecommendationList';

interface ResultsPageProps {
  profile: SeniorProfile | null;
  recommendations: RecommendationResponse | null;
}

export default function ResultsPage({ profile, recommendations }: ResultsPageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%' }}>
      <div style={{ width: '40%', padding: '24px', borderRight: '1px solid #E2E2E2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9F9F9' }}>
        {profile ? <ProfileCard profile={profile} /> : <p>프로필 정보를 불러오는 중...</p>}
      </div>
      <div style={{ width: '60%', padding: '24px', overflowY: 'auto' }}>
        {recommendations ? <RecommendationList recommendations={recommendations} /> : <p>추천 목록을 불러오는 중...</p>}
      </div>
    </div>
  );
}
