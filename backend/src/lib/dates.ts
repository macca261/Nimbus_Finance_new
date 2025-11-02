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


