import type { CategoryId } from '../types/category';
export type { CategoryId } from '../types/category';

const CATEGORY_DATA: Array<{
  id: CategoryId;
  label: string;
  group: 'income' | 'expense' | 'transfer' | 'savings' | 'other';
  priority: number;
}> = [
  { id: 'income_salary', label: 'Gehalt & Lohn', group: 'income', priority: 1 },
  { id: 'income_other', label: 'Sonstige Einnahmen', group: 'income', priority: 2 },
  { id: 'p2p_in', label: 'P2P-Eingänge', group: 'income', priority: 3 },
  { id: 'rent', label: 'Miete & Wohnkosten', group: 'expense', priority: 10 },
  { id: 'utilities', label: 'Versorger & Nebenkosten', group: 'expense', priority: 11 },
  { id: 'groceries', label: 'Lebensmittel & Drogerie', group: 'expense', priority: 12 },
  { id: 'dining_out', label: 'Gastronomie & Café', group: 'expense', priority: 13 },
  { id: 'delivery', label: 'Essenslieferungen', group: 'expense', priority: 14 },
  { id: 'transport', label: 'ÖPNV & Mobilität', group: 'expense', priority: 15 },
  { id: 'car', label: 'Auto & Mobilität', group: 'expense', priority: 16 },
  { id: 'shopping', label: 'Shopping & Einzelhandel', group: 'expense', priority: 17 },
  { id: 'subscriptions', label: 'Abos & Mitgliedschaften', group: 'expense', priority: 18 },
  { id: 'telecom_internet', label: 'Telekom & Internet', group: 'expense', priority: 19 },
  { id: 'insurance', label: 'Versicherungen', group: 'expense', priority: 20 },
  { id: 'fees_charges', label: 'Bankgebühren & Zinsen', group: 'expense', priority: 21 },
  { id: 'cash_withdrawal', label: 'Bargeldabhebungen', group: 'expense', priority: 22 },
  { id: 'transfer_internal', label: 'Interne Überträge', group: 'transfer', priority: 30 },
  { id: 'transfer_external', label: 'Externe Überweisungen', group: 'transfer', priority: 31 },
  { id: 'p2p_out', label: 'P2P-Ausgänge', group: 'transfer', priority: 32 },
  { id: 'savings_investments', label: 'Sparen & Investieren', group: 'savings', priority: 40 },
  { id: 'taxes', label: 'Steuern & Abgaben', group: 'expense', priority: 41 },
  { id: 'health', label: 'Gesundheit & Pflege', group: 'expense', priority: 42 },
  { id: 'education', label: 'Bildung & Weiterbildung', group: 'expense', priority: 43 },
  { id: 'paypal_fee', label: 'PayPal Gebühren', group: 'expense', priority: 50 },
  { id: 'paypal_refund', label: 'PayPal Rückerstattungen', group: 'income', priority: 51 },
  { id: 'paypal_payout', label: 'PayPal Auszahlungen', group: 'transfer', priority: 52 },
  { id: 'paypal_hold', label: 'PayPal Halte', group: 'other', priority: 53 },
  { id: 'currency_conversion_diff', label: 'Wechselkurs-Differenzen', group: 'expense', priority: 60 },
  { id: 'other_review', label: 'Bitte prüfen', group: 'other', priority: 90 },
  { id: 'other', label: 'Sonstiges', group: 'other', priority: 95 },
];

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  group: 'income' | 'expense' | 'transfer' | 'savings' | 'other';
  priority: number;
}

export const CATEGORIES: CategoryDefinition[] = CATEGORY_DATA.map(item => ({ ...item }));

const CATEGORY_INDEX: Record<CategoryId, CategoryDefinition> = CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category;
  return acc;
}, {} as Record<CategoryId, CategoryDefinition>);

export const DEFAULT_CATEGORY: CategoryId = 'other_review';

export function getCategoryDefinition(id: CategoryId): CategoryDefinition {
  return CATEGORY_INDEX[id] ?? CATEGORY_INDEX.other_review;
}

export function isValidCategory(id: string): id is CategoryId {
  return (CATEGORY_INDEX as Record<string, CategoryDefinition>)[id] !== undefined;
}

export const CATEGORY_IDS: CategoryId[] = CATEGORIES.map(cat => cat.id);


