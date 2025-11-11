const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const defaultDateFormatter = new Intl.DateTimeFormat('de-DE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const defaultPercentFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return eurFormatter.format(0);
  return eurFormatter.format(value);
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return defaultDateFormatter.format(date);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return defaultPercentFormatter.format(value);
}

export const formatCurrencyEUR = (value: number | null | undefined) => formatCurrency(value ?? 0);
export const formatDateDE = (iso: string | null | undefined) => formatDate(iso ?? undefined);
