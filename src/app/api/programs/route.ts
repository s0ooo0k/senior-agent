import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type {
  JobItem,
  PolicyItem,
  EducationItem,
  ProgramItem,
} from '@/types/domain';

import jobsData from '@/data/jobs.json';
import policiesData from '@/data/policies.json';
import educationsData from '@/data/educations.json';

function jobToProgram(job: JobItem): ProgramItem {
  return {
    id: job.id,
    title: job.title,
    type: 'job',
    region: job.region,
    description: job.description,
    benefits: `급여: ${job.min_salary.toLocaleString()}~${job.max_salary.toLocaleString()}원`,
    requirements: `활동량: ${job.activity_level}, 자세: ${job.posture}, 디지털: ${job.requires_digital ? '필요' : '불필요'}`,
    duration: `주 ${job.work_days}일`,
    deadline: job.deadline,
    tags: job.tags,
  };
}

function policyToProgram(policy: PolicyItem): ProgramItem {
  return {
    id: policy.id,
    title: policy.title,
    type: 'policy',
    region: policy.region,
    target_age: policy.target_age,
    description: policy.description,
    benefits: policy.benefit,
    deadline: policy.deadline,
    link: policy.link,
    tags: policy.tags,
  };
}

function educationToProgram(education: EducationItem): ProgramItem {
  return {
    id: education.id,
    title: education.title,
    type: 'education',
    region: education.region,
    description: education.summary,
    requirements: `디지털: ${education.requires_digital ? '필요' : '불필요'}`,
    duration: education.duration,
    cost: education.cost,
    start_date: education.start_date,
    tags: education.tags,
    provider: education.provider,
  };
}

export async function GET() {
  try {
    const jobs = jobsData as JobItem[];
    const policies = policiesData as PolicyItem[];
    const educations = educationsData as EducationItem[];

    // parsed 디렉토리의 프로그램 불러오기
    const parsedDir = join(process.cwd(), 'src', 'data', 'parsed');
    let parsedPrograms: ProgramItem[] = [];

    try {
      const files = await readdir(parsedDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(parsedDir, file), 'utf-8');
          const parsed = JSON.parse(content) as { programs?: ProgramItem[] };
          if (Array.isArray(parsed.programs)) {
            parsedPrograms.push(...parsed.programs);
          }
        } catch (err) {
          console.error(`Failed to read parsed file ${file}:`, err);
        }
      }
    } catch (err) {
      // parsed 폴더가 없거나 접근 실패해도 나머지 데이터는 반환
      console.warn('No parsed directory or unable to read parsed files:', err);
    }

    // 모든 데이터를 ProgramItem 형식으로 변환
    const allPrograms: ProgramItem[] = [
      ...jobs.map(jobToProgram),
      ...policies.map(policyToProgram),
      ...educations.map(educationToProgram),
      ...parsedPrograms,
    ];

    return NextResponse.json({
      total: allPrograms.length,
      breakdown: {
        jobs: jobs.length,
        policies: policies.length,
        educations: educations.length,
        parsed: parsedPrograms.length,
      },
      programs: allPrograms,
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch programs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
