import type { Database } from 'better-sqlite3';
import { insertTransactions, type CanonicalRow } from './db';
import { categorize } from './categorization';

export type InsertRow = {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  direction?: 'in' | 'out';
  counterpartName?: string | null;
  counterpartyIban?: string | null;
  accountIban?: string | null;
  bankProfile?: string | null;
  rawCode?: string | null;
  raw?: Record<string, unknown> | null;
  importFile?: string | null;
  category?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  categoryExplanation?: string | null;
  categoryRuleId?: string | null;
};

export function insertManyTransactions(db: Database, rows: InsertRow[]) {
  const canonical: CanonicalRow[] = rows.map(row => {
    let category = row.category ?? undefined;
    let categorySource = row.categorySource ?? undefined;
    let categoryConfidence = row.categoryConfidence ?? undefined;
    let categoryExplanation = row.categoryExplanation ?? undefined;
    let categoryRuleId = row.categoryRuleId ?? undefined;

    if (!category) {
      const textParts = [
        row.purpose,
        row.counterpartName ?? undefined,
        row.accountIban ?? undefined,
      ].filter((value): value is string => Boolean(value && value.toString().trim()));
      const result = categorize({
        text: textParts.join(' '),
        amount: row.amountCents / 100,
        amountCents: row.amountCents,
        iban: row.accountIban ?? null,
        counterpart: row.counterpartName ?? null,
        memo: row.purpose,
        payee: row.counterpartName ?? null,
        source: row.bankProfile ? 'csv_bank' : 'manual',
      });
      category = result.category;
      categorySource = categorySource ?? result.source;
      categoryConfidence = categoryConfidence ?? result.confidence;
      categoryExplanation = categoryExplanation ?? result.explanation;
      categoryRuleId = categoryRuleId ?? result.ruleId;
    }

    return {
      bookingDate: row.bookingDate,
      valueDate: row.valueDate,
      amountCents: row.amountCents,
      currency: row.currency,
      purpose: row.purpose,
      direction: row.direction ?? (row.amountCents >= 0 ? 'in' : 'out'),
      counterpartName: row.counterpartName ?? undefined,
      counterpartyIban: row.counterpartyIban ?? undefined,
      accountIban: row.accountIban ?? undefined,
      bankProfile: row.bankProfile ?? undefined,
      rawCode: row.rawCode ?? undefined,
      raw: row.raw ?? undefined,
      importFile: row.importFile ?? undefined,
        category,
      categorySource,
      categoryConfidence,
      categoryExplanation,
      categoryRuleId,
    };
  });

  return insertTransactions(canonical, db);
}
