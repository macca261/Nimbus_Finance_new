export type AchievementStatus = 'locked' | 'in_progress' | 'completed';

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  type: string;
  status: AchievementStatus;
  progress: number; // 0–100
  unlockedAt?: string | null;
}

