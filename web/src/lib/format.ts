export const fmtEUR = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
    .format((cents ?? 0) / 100);

export const formatEuro = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100);

