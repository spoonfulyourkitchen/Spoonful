const DAY_MS = 86400000;

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export function skillLevel(experience?: string, startedAt?: number): SkillLevel {
  const base = String(experience ?? '').toLowerCase();
  const weeks = startedAt ? (Date.now() - startedAt) / (7 * DAY_MS) : 0;
  const timeRank = weeks >= 8 ? 2 : weeks >= 3 ? 1 : 0;
  const baseRank =
    base === 'professional' || base === '5+ years' || base === '3-5 years'
      ? 2
      : base === '1-2 years'
        ? 1
        : 0;
  const rank = Math.min(2, Math.max(baseRank, timeRank));
  return rank === 2 ? 'advanced' : rank === 1 ? 'intermediate' : 'beginner';
}

export function experienceForAi(level: SkillLevel): string {
  if (level === 'advanced') return 'professional';
  if (level === 'intermediate') return '1-2 years';
  return 'beginner';
}

export function difficultyForSkill(level: SkillLevel): 'easy' | 'medium' | 'all' {
  if (level === 'advanced') return 'all';
  if (level === 'intermediate') return 'medium';
  return 'easy';
}
