export type TriedProfile = {
  id: string;
  confidence: number;
  reasons: string[];
};

export type NormalizedTransaction = {
  bookedAt: string;
  valueDate?: string;
  amount: number;
  currency: string;
  counterpart?: string;
  purpose?: string;
  iban?: string;
  bic?: string;
  balanceAfter?: number;
  category?: string;
  raw?: Record<string, string>;
};

export interface ImportSuccessPayload {
  ok: true;
  profileId: string;
  confidence: number;
  fileName: string;
  transactionCount: number;
  insertedCount?: number;
  duplicateCount?: number;
  warnings: string[];
  openingBalance?: number;
  closingBalance?: number;
}

export interface ParseMeta {
  profileId: string;
  confidence: number;
  openingBalance?: number;
  closingBalance?: number;
  warnings: string[];
  lastFilename?: string;
  lastImportedAt?: string;
  transactionCount?: number;
  insertedCount?: number;
  duplicateCount?: number;
}
