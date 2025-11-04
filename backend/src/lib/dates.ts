export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function firstDayMonthsAgo(n: number, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth() - n, 1);
}

export function lastDayMonthsAgo(n: number, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth() - n + 1, 0);
}

export function getMonthRange(month?: string, now = new Date()) {
  let year = now.getUTCFullYear();
  let monthIndex = now.getUTCMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
      year = y;
      monthIndex = m - 1;
    }
  }
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  const label = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return { start: toIso(startDate), end: toIso(endDate), month: label };
}

export function longestDailyStreak(dates: string[], start: string, end: string): number {
  if (!dates.length) return 0;
  const set = new Set(dates.filter(d => d >= start && d <= end));
  if (!set.size) return 0;
  let longest = 0;
  let current = 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    if (set.has(key)) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return longest;
}


