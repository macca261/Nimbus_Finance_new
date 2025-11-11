export interface TransactionDto {
  id: number;
  bookedAt: string | null;
  valueDate?: string | null;
  amount: number;
  currency: string;
  counterpart?: string | null;
  purpose?: string | null;
  category?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  categoryExplanation?: string | null;
}

export async function fetchTransactions(): Promise<TransactionDto[]> {
  const res = await fetch('/api/transactions');
  if (!res.ok) {
    throw new Error('Failed to load transactions');
  }
  const data = await res.json();
  return Array.isArray(data?.transactions) ? (data.transactions as TransactionDto[]) : [];
}


