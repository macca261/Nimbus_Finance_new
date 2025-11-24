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
  displayName?: string; // Human-friendly short name (computed from payee/counterpartName/purpose/memo)
  rawText: string; // Full raw booking text (for detail views)
  isInternalTransfer?: boolean; // Excluded from review queue, but included in interface for defensive filtering
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null;
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

export interface ReimbursementAllocation {
  id: number;
  inflowTransactionId: string;
  expenseTransactionId: string;
  allocatedAmountCents: number;
}

export interface ReimbursementGroup {
  groupId: string;
  counterpartName: string | null;
  txCount: number;
  totalInflowCents: number;
  totalOutflowCents: number;
  totalExpenseCents: number;
  netImpactCents: number;
  lastBookingDate: string;
  confidence: number; // 0-100
  primaryCategoryId?: string | null;
  primaryCategoryLabel?: string | null;
  allocations?: ReimbursementAllocation[];
  inflows: Array<{
    id: number;
    bookingDate: string;
    amountCents: number;
    purpose: string | null;
    category: string | null;
  }>;
  outflows: Array<{
    id: number;
    bookingDate: string;
    amountCents: number;
    purpose: string | null;
    category: string | null;
  }>;
}

export async function fetchReimbursementGroups(): Promise<ReimbursementGroup[]> {
  const res = await fetch('/api/review/reimbursements');
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Erstattungs-Gruppen');
  }
  const data = await res.json();
  return data.groups ?? [];
}

export async function markPassThrough(transactionIds: number[]): Promise<void> {
  if (transactionIds.length < 2) {
    throw new Error('Mindestens zwei Transaktionen erforderlich');
  }

  // Use the existing pass-through API which requires exactly 2 transactions
  // For groups with more transactions, we'll need to pair them
  // For now, we'll handle pairs only
  if (transactionIds.length === 2) {
    const res = await fetch('/api/transactions/pass-through', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      throw new Error(error.error || 'Fehler beim Markieren als durchlaufende Posten');
    }
  } else {
    // For groups with more than 2 transactions, mark them in pairs
    // This is a simplified approach - in a real scenario, you might want to
    // create a batch endpoint or handle this differently
    const pairs: number[][] = [];
    for (let i = 0; i < transactionIds.length; i += 2) {
      if (i + 1 < transactionIds.length) {
        pairs.push([transactionIds[i], transactionIds[i + 1]]);
      }
    }

    // Mark all pairs
    await Promise.all(
      pairs.map(pair =>
        fetch('/api/transactions/pass-through', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: pair }),
        }).then(res => {
          if (!res.ok) {
            throw new Error('Fehler beim Markieren als durchlaufende Posten');
          }
        }),
      ),
    );
  }
}

export async function ignoreReimbursementGroup(groupId: string): Promise<void> {
  const response = await fetch(`/api/review/reimbursements/${encodeURIComponent(groupId)}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to ignore reimbursement group');
  }
}

export async function saveReimbursementAllocations(
  groupId: string,
  inflowTransactionId: string,
  allocations: { expenseTransactionId: string; allocatedAmountCents: number }[]
): Promise<void> {
  const response = await fetch(`/api/review/reimbursements/${encodeURIComponent(groupId)}/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inflowTransactionId, allocations }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Fehler beim Speichern der Verknüpfung');
  }
}

