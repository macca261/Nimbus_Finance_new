import type { GoalProgress, CreateGoalInput, UpdateGoalInput } from '../types/goals';

export async function fetchGoals(params?: { isActive?: boolean }): Promise<GoalProgress[]> {
  const queryParams = new URLSearchParams();
  if (params?.isActive !== undefined) {
    queryParams.set('isActive', String(params.isActive));
  }
  
  const url = `/api/goals${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Ziele');
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchGoalById(id: string): Promise<GoalProgress> {
  const res = await fetch(`/api/goals/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error('Fehler beim Laden des Ziels');
  }
  const json = await res.json();
  return json.data;
}

export async function createGoal(input: CreateGoalInput): Promise<GoalProgress> {
  const res = await fetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Fehler beim Erstellen des Ziels' }));
    throw new Error(error.error || 'Fehler beim Erstellen des Ziels');
  }
  const json = await res.json();
  return json.data;
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<GoalProgress> {
  const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Fehler beim Aktualisieren des Ziels' }));
    throw new Error(error.error || 'Fehler beim Aktualisieren des Ziels');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Fehler beim Löschen des Ziels');
  }
}

export interface GoalHybridStatus {
  goalId: string;
  mode: 'simple' | 'hybrid' | 'locked';
  aiAssisted: boolean;
  canToggle: boolean;
  lastEvaluatedAt: string | null;
  virtualBalanceCents?: number;
  externalBalanceCents?: number;
  totalProgressCents?: number;
  progressPercent?: number;
}

/**
 * Fetch hybrid status for a goal
 * Returns null if goal doesn't exist or hybrid status is unavailable
 */
export async function fetchGoalHybridStatus(goalId: string): Promise<GoalHybridStatus | null> {
  try {
    const res = await fetch(`/api/goals/${encodeURIComponent(goalId)}/hybrid-status`);
    if (res.status === 404) {
      return null; // Goal not found or no hybrid status
    }
    if (!res.ok) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[goalsApi] hybrid-status failed', {
          goalId,
          status: res.status,
          statusText: res.statusText,
        });
      }
      return null;
    }
    const json = await res.json();
    return json.data || null;
  } catch (err: any) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[goalsApi] hybrid-status error', err);
    }
    return null; // Return null on network errors too
  }
}

