export type CategoryMeta = {
  label: string;
  color: string;
  background: string;
};

const CATEGORIES: Record<string, CategoryMeta> = {
  income_salary: { label: 'Gehalt & Lohn', color: '#2563EB', background: 'rgba(37,99,235,0.12)' },
  income_other: { label: 'Sonstige Einnahmen', color: '#1D4ED8', background: 'rgba(29,78,216,0.12)' },
  groceries: { label: 'Lebensmittel & Drogerie', color: '#15803D', background: 'rgba(21,128,61,0.12)' },
  dining_out: { label: 'Gastronomie & Café', color: '#F97316', background: 'rgba(249,115,22,0.12)' },
  delivery: { label: 'Essenslieferungen', color: '#F59E0B', background: 'rgba(245,158,11,0.12)' },
  transport: { label: 'Mobilität & Transport', color: '#0EA5E9', background: 'rgba(14,165,233,0.12)' },
  subscriptions: { label: 'Abos & Mitgliedschaften', color: '#DB2777', background: 'rgba(219,39,119,0.12)' },
  telecom_internet: { label: 'Telekom & Internet', color: '#6366F1', background: 'rgba(99,102,241,0.12)' },
  fees_charges: { label: 'Gebühren & Zinsen', color: '#EA580C', background: 'rgba(234,88,12,0.12)' },
  savings_investments: { label: 'Sparen & Investieren', color: '#0F766E', background: 'rgba(15,118,110,0.12)' },
  shopping: { label: 'Shopping', color: '#DC2626', background: 'rgba(220,38,38,0.12)' },
  rent: { label: 'Miete & Wohnen', color: '#7C3AED', background: 'rgba(124,58,237,0.12)' },
  utilities: { label: 'Versorger & Nebenkosten', color: '#22D3EE', background: 'rgba(34,211,238,0.12)' },
  insurance: { label: 'Versicherungen', color: '#9333EA', background: 'rgba(147,51,234,0.12)' },
  cash_withdrawal: { label: 'Bargeldabhebung', color: '#DB2777', background: 'rgba(219,39,119,0.12)' },
  transfer_internal: { label: 'Interne Transfers', color: '#0891B2', background: 'rgba(8,145,178,0.12)' },
  p2p_in: { label: 'P2P-Eingänge', color: '#10B981', background: 'rgba(16,185,129,0.12)' },
  p2p_out: { label: 'P2P-Ausgänge', color: '#F97316', background: 'rgba(249,115,22,0.12)' },
  paypal_fee: { label: 'PayPal Gebühren', color: '#FB7185', background: 'rgba(251,113,133,0.12)' },
  paypal_refund: { label: 'PayPal Rückerstattung', color: '#34D399', background: 'rgba(52,211,153,0.12)' },
  paypal_payout: { label: 'PayPal Auszahlungen', color: '#38BDF8', background: 'rgba(56,189,248,0.12)' },
  paypal_hold: { label: 'PayPal Halte', color: '#FBBF24', background: 'rgba(251,191,36,0.12)' },
  currency_conversion_diff: { label: 'Wechselkurs-Differenz', color: '#475569', background: 'rgba(71,85,105,0.12)' },
  health: { label: 'Gesundheit', color: '#BE123C', background: 'rgba(190,18,60,0.12)' },
  taxes: { label: 'Steuern', color: '#B45309', background: 'rgba(180,83,9,0.12)' },
  other: { label: 'Sonstiges', color: '#475569', background: 'rgba(71,85,105,0.12)' },
};

export function getCategoryMeta(id?: string | null): CategoryMeta {
  if (!id) return CATEGORIES.other;
  return CATEGORIES[id] ?? CATEGORIES.other;
}

export function getCategoryLabel(id?: string | null): string {
  return getCategoryMeta(id).label;
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([id, meta]) => ({
  id,
  label: meta.label,
}));

