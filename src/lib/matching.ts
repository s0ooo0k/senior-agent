import type {
  EducationItem,
  JobItem,
  PolicyItem,
  SeniorProfile,
} from "@/types/domain";

const DEFAULT_REGION = process.env.DEFAULT_REGION ?? "부산";

const levelOrder: Record<string, number> = { 낮음: 1, 중간: 2, 높음: 3 };

function normalize(text: string) {
  return text.replace(/\s+/g, "").toLowerCase();
}

function isCloseRegion(itemRegion: string, targetRegion: string) {
  const normItem = normalize(itemRegion);
  const normTarget = normalize(targetRegion);
  return (
    normItem.includes(normTarget) ||
    normTarget.includes(normItem) ||
    (normItem.startsWith("부산") && normTarget.startsWith("부산")) ||
    (normItem.startsWith("울산") && normTarget.startsWith("울산")) ||
    (normItem.startsWith("경남") && normTarget.startsWith("경남"))
  );
}

function parseSalary(text: string) {
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const value = Number(numbers.join(""));
  // 입력이 시급(예: 12000)일 경우를 대비해 단위 추정
  return value >= 100000 ? value : value * 160; // 대략 주 20시간 * 4주
}

export function scoreJob(profile: SeniorProfile, job: JobItem) {
  const region = profile.region ?? DEFAULT_REGION;
  let score = 0;

  if (isCloseRegion(job.region, region)) score += 3;

  const desiredDays = profile.weekly_work_days || 3;
  const dayDiff = Math.abs(job.work_days - desiredDays);
  score += dayDiff === 0 ? 2 : dayDiff === 1 ? 1 : 0;

  const profileActivity = levelOrder[profile.activity_level] ?? 2;
  const jobActivity = levelOrder[job.activity_level] ?? 2;
  const activityDiff = Math.abs(profileActivity - jobActivity);
  score += activityDiff === 0 ? 2 : activityDiff === 1 ? 1 : -1;

  const posturePref = normalize(profile.work_posture);
  if (posturePref && normalize(job.posture).includes(posturePref)) score += 1.5;

  const socialPref = normalize(profile.social_preference);
  if (socialPref.includes("혼") && job.social_level === "낮음") score += 1;
  else if (socialPref.includes("같이") && job.social_level !== "낮음") score += 1;

  const expectedSalary = parseSalary(profile.salary_expectation);
  if (expectedSalary) {
    if (expectedSalary >= job.min_salary && expectedSalary <= job.max_salary) {
      score += 2;
    } else {
      const gap =
        expectedSalary < job.min_salary
          ? job.min_salary - expectedSalary
          : expectedSalary - job.max_salary;
      if (gap < 200000) score += 1;
    }
  }

  if (job.requires_digital && normalize(profile.digital_literacy).includes("낮")) {
    score -= 2;
  }

  return score;
}

export function filterJobs(profile: SeniorProfile, jobs: JobItem[], limit = 20) {
  return jobs
    .map((job) => ({ job, score: scoreJob(profile, job) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function filterPolicies(
  profile: SeniorProfile,
  policies: PolicyItem[],
  limit = 5,
) {
  const region = profile.region ?? DEFAULT_REGION;
  return policies
    .filter(
      (p) =>
        p.region === "전국" ||
        isCloseRegion(p.region, region) ||
        normalize(region).includes(normalize(p.region)),
    )
    .slice(0, limit);
}

export function filterEducations(
  profile: SeniorProfile,
  educations: EducationItem[],
  limit = 5,
) {
  const region = profile.region ?? DEFAULT_REGION;
  return educations
    .filter(
      (e) =>
        e.region === "온라인" ||
        isCloseRegion(e.region, region) ||
        normalize(region).includes(normalize(e.region)),
    )
    .filter((e) => {
      const digitalLow = normalize(profile.digital_literacy).includes("낮");
      return !(e.requires_digital && digitalLow);
    })
    .slice(0, limit);
}
