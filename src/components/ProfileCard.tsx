'use client';

import Image from 'next/image';
import type { SeniorProfile } from '@/types/domain';

const cardStyle: React.CSSProperties = {
  backgroundColor: '#F9F9F9',
  border: '1px solid #E2E2E2',
  borderRadius: 'var(--border-radius)',
  padding: '24px',
  textAlign: 'center',
  width: '100%',
  maxWidth: '300px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};

const imageStyle: React.CSSProperties = {
  borderRadius: '50%',
  marginBottom: '16px',
};

const nameStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: '600',
  marginBottom: '8px',
};

const summaryStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary-color)',
  marginBottom: '16px',
  whiteSpace: 'pre-line',
};

const tagContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
}

const tagStyle: React.CSSProperties = {
    backgroundColor: 'var(--primary-color)',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '16px',
    fontSize: '0.8rem',
}

interface ProfileCardProps {
    profile: SeniorProfile;
}

// A simple hash function to pick an image
const selectImage = (summary: string) => {
    let hash = 0;
    for (let i = 0; i < summary.length; i++) {
        const char = summary.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % 4 + 1; // 1 to 4
    return `/image${index}.png`;
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const imageUrl = selectImage(profile.persona_summary);

  return (
    <div style={cardStyle}>
      <Image
        src={imageUrl}
        alt="Profile"
        width={100}
        height={100}
        style={imageStyle}
      />
      <h3 style={nameStyle}>{profile.persona_summary.split('\n')[0]}</h3>
      <p style={summaryStyle}>{profile.persona_summary}</p>
      <div style={tagContainerStyle}>
        {profile.skills?.slice(0, 4).map(skill => (
            <span key={skill} style={tagStyle}>{skill}</span>
        ))}
      </div>
    </div>
  );
}
