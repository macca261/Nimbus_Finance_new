import type { Achievement } from '../types/achievements';

export async function fetchAchievements(): Promise<Achievement[]> {
  const res = await fetch('/api/achievements');
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Erfolge');
  }
  const json = await res.json();
  return json.data || [];
}

export async function evaluateAchievements(): Promise<Achievement[]> {
  const res = await fetch('/api/achievements/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Fehler beim Auswerten der Erfolge');
  }
  const json = await res.json();
  return json.data || [];
}

