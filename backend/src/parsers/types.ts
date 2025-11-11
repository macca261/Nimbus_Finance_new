export type NormalizedTransaction = {
  bookedAt: string; // ISO 8601 (YYYY-MM-DD or full ISO)
  valueDate?: string; // ISO 8601
  amount: number; // + inflow, - outflow
  currency: string; // e.g., "EUR"
  counterpart?: string;
  purpose?: string;
  iban?: string;
  bic?: string;
  balanceAfter?: number;
  raw?: Record<string, string>;
};

export type BankProfile = {
  id: string;
  displayName: string;
  headerHints: string[]; // lowercased tokens we expect
  columnMap: (headers: string[]) => {
    bookedAt?: string;
    valueDate?: string;
    amount?: string;
    currency?: string;
    counterpart?: string;
    purpose?: string;
    iban?: string;
    bic?: string;
    balanceAfter?: string;
  };
  preprocess?: (lines: string[]) => string[]; // e.g., skip preamble before header row
  parseRow?: (row: Record<string, string>) => Record<string, string>; // row cleanup per bank
  sanityCheck?: (rows: Record<string, string>[]) => { ok: boolean; reason?: string };
  examples?: string[];
};

export type DetectResult = {
  profileId: string;
  confidence: number; // 0..1
  reasons: string[];
};

