import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { CategoryDecision } from '@nimbus/shared/src/categorisation';
import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import { categoriseWithRulesOnly } from '../categorisation/applyRules';

/**
 * Transaction Categorization Engine (TCE)
 * 
 * Detects German banking patterns to identify external savings transfers.
 * This enables the "Hybrid Savings" system by automatically flagging transactions
 * to Trade Republic, Scalable Capital, and other investment platforms as savings
 * rather than expenses.
 */

export interface SavingsDetectionResult {
  type: 'INVESTMENT' | 'SAVINGS_PLAN' | 'ROBO_ADVISOR' | 'MICRO_SAVINGS' | null;
  confidence: number;
  entity: 'NEOBROKER' | 'BANK' | 'ROBO' | 'APP' | null;
  isExternalSavings: boolean;
}

/**
 * Detects if a transaction is an external savings transfer
 * specific to the German market context.
 * 
 * @param payee - Payee name from transaction
 * @param memo - Memo/purpose text from transaction
 * @returns Detection result or null if not a savings transfer
 */
export function detectSavings(payee: string | null, memo: string | null): SavingsDetectionResult | null {
  const cleanText = `${payee || ''} ${memo || ''}`.toUpperCase().trim();
  
  if (!cleanText) {
    return null;
  }

  // 1. Broker Detection (Neobrokers)
  // Matches Trade Republic, Scalable, Flatex, Comdirect, Baader Bank
  if (/TRADE\s?REPUBLIC|SCALABLE|FLATEX|COMDIRECT|BAADER\s?BANK/.test(cleanText)) {
    return { 
      type: 'INVESTMENT', 
      confidence: 0.95, 
      entity: 'NEOBROKER',
      isExternalSavings: true
    };
  }

  // 2. Savings Keywords (Traditional)
  // Matches "Sparplan" (Savings Plan), "Wertpapier" (Security), "Depot" (Portfolio)
  if (/SPARPLAN|WERTPAPIER|DEPOT|FONDSKAUF|ETF\s?KAUF/.test(cleanText)) {
    return { 
      type: 'SAVINGS_PLAN', 
      confidence: 0.90, 
      entity: 'BANK',
      isExternalSavings: true
    };
  }

  // 3. Robo-Advisors
  // Matches common German robo-advisors
  if (/LIQID|QUIRION|GINMON|WESTWING/.test(cleanText)) {
    return { 
      type: 'ROBO_ADVISOR', 
      confidence: 0.95, 
      entity: 'ROBO',
      isExternalSavings: true
    };
  }

  // 4. High-Yield Savings Accounts
  // Matches Tagesgeld (call money), Festgeld (fixed deposit)
  if (/TAGESGELD|FESTGELD|TAGEGELDKONTO/.test(cleanText)) {
    return { 
      type: 'SAVINGS_PLAN', 
      confidence: 0.85, 
      entity: 'BANK',
      isExternalSavings: true
    };
  }

  // 5. Round-Ups (Micro-savings)
  if (/ROUND-UP|AUFRUNDUNG|SAVEBACK/.test(cleanText)) {
    return { 
      type: 'MICRO_SAVINGS', 
      confidence: 0.85, 
      entity: 'APP',
      isExternalSavings: true
    };
  }

  // 6. Internal Transfer Keywords (might be savings)
  // UMBUCHUNG, ÜBERTRAG - but these need account context to determine
  // We'll handle these separately in the auto-link logic

  return null;
}

export function categorizeTransaction(
  transactionId: string,
  conn: BetterSqliteDatabase
): CategoryDecision | null {
  const row = conn
    .prepare(`
      SELECT bookingDate,
             valueDate,
             amountCents,
             currency,
             counterpartName,
             counterpartyIban,
             purpose,
             rawCode
      FROM transactions
      WHERE id = ?
    `)
    .get(transactionId) as
    | {
        bookingDate: string | null;
        valueDate: string | null;
        amountCents: number | null;
        currency: string | null;
        counterpartName: string | null;
        counterpartyIban: string | null;
        purpose: string | null;
        rawCode: string | null;
      }
    | undefined;

  if (!row) return null;

  const tx: CanonicalTransaction = {
    id: transactionId,
    bookingDate: row.bookingDate ?? new Date().toISOString().slice(0, 10),
    valueDate: row.valueDate ?? undefined,
    amount: Number(row.amountCents ?? 0) / 100,
    currency: row.currency ?? 'EUR',
    counterpartName: row.counterpartName ?? undefined,
    counterpartIban: row.counterpartyIban ?? undefined,
    counterpartBic: undefined,
    purpose: row.purpose ?? undefined,
    txType: undefined,
    rawCode: row.rawCode ?? undefined,
  };

  return categoriseWithRulesOnly(tx);
}

