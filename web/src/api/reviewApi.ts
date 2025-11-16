export interface ReviewTransaction {
  id: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  direction: 'in' | 'out';
  category: string | null;
  categorySource: string | null;
  categoryConfidence: number | null;
  categoryExplanation?: {
    ruleId: string;
    merchantName?: string;
    matchedText?: string;
  } | null;
  rawText: string;
}

export interface CategoryMeta {
  id: string;
  labelDe: string;
  parentId?: string | null;
  isIncome?: boolean;
  isTransfer?: boolean;
  isEssential?: boolean;
}

export async function fetchReviewTransactions(): Promise<ReviewTransaction[]> {
  const res = await fetch('/api/review/transactions');
  if (!res.ok) {
    throw new Error('Fehler beim Laden der zu prüfenden Buchungen');
  }
  const data = await res.json();
  return data.items ?? [];
}

export async function fetchCategories(): Promise<CategoryMeta[]> {
  const res = await fetch('/api/categories');
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Kategorien');
  }
  const data = await res.json();
  return data.items ?? [];
}

