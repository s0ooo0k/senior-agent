export type AnswerMap = Record<`q${number}`, string>;

export interface SeniorProfile {
  previous_job: string;
  skills: string[];
  activity_level: "낮음" | "중간" | "높음" | string;
  work_posture: string;
  weekly_work_days: number;
  salary_expectation: string;
  social_preference: string;
  learning_preference: string;
  digital_literacy: string;
  motivation: string;
  persona_summary: string;
  region?: string;
}

export interface JobItem {
  id: string;
  title: string;
  region: string;
  work_days: number;
  work_type: string;
  activity_level: "낮음" | "중간" | "높음" | string;
  posture: string;
  min_salary: number;
  max_salary: number;
  social_level: string;
  requires_digital: boolean;
  tags: string[];
  description: string;
  deadline: string;
}

export interface PolicyItem {
  id: string;
  title: string;
  region: string;
  target_age: string;
  benefit: string;
  description: string;
  link?: string;
  deadline?: string;
  tags?: string[];
}

export interface EducationItem {
  id: string;
  title: string;
  region: string;
  mode: "오프라인" | "온라인" | "혼합";
  duration: string;
  cost?: string;
  start_date?: string;
  requires_digital: boolean;
  tags: string[];
  summary: string;
  provider?: string;
}

export interface RankedRecommendation {
  id: string;
  score: number;
  reason: string;
  type: "job" | "policy" | "education";
}
