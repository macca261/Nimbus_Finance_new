const DEFAULT_LOCALE = 'de-DE'

export type MonthOption = {
  value: string;
  label: string;
  short: string;
  date: Date;
}

export function formatMonthLabel(ym?: string | null, locale = DEFAULT_LOCALE): string {
  if (!ym) return 'Aktuell'
  const [y, m] = ym.split('-').map(Number)
  if (Number.isNaN(y) || Number.isNaN(m)) return 'Aktuell'
  const date = new Date(Date.UTC(y, m - 1, 1))
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
}

export function formatMonthShort(ym: string, locale = DEFAULT_LOCALE): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, 1))
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function buildRecentMonths(count = 6, reference = new Date(), locale = DEFAULT_LOCALE): MonthOption[] {
  return Array.from({ length: count }, (_, idx) => {
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - idx, 1))
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    return {
      value,
      label: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date),
      short: new Intl.DateTimeFormat(locale, { month: 'short' }).format(date),
      date,
    }
  })
}

