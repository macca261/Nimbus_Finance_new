import type { NormalizedTransaction } from '../types/transactions';

/**
 * Redacted transaction data safe for AI processing.
 * All sensitive information (IBANs, card numbers, emails) is masked.
 */
export interface RedactedTransaction {
  description: string;
  amount: number;
  direction: 'in' | 'out';
  date: string;
}

/**
 * Patterns to detect and mask sensitive information.
 */
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[\s-]?(?:\d{4}[\s-]?){2,}\d{1,4}\b/gi;
const CARD_NUMBER_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const LONG_DIGIT_SEQUENCE = /\b\d{8,}\b/g; // 8+ consecutive digits
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Mask sensitive patterns in text.
 */
function maskSensitiveText(text: string): string {
  let masked = text;

  // Mask IBANs
  masked = masked.replace(IBAN_PATTERN, '****');

  // Mask card numbers
  masked = masked.replace(CARD_NUMBER_PATTERN, '****');

  // Mask long digit sequences (account numbers, reference IDs, etc.)
  masked = masked.replace(LONG_DIGIT_SEQUENCE, '****');

  // Mask email addresses
  masked = masked.replace(EMAIL_PATTERN, '****');

  return masked;
}

/**
 * Build a concise description from transaction fields.
 * Combines booking text, merchant/counterparty, and tags, with sensitive data masked.
 */
function buildDescription(tx: NormalizedTransaction): string {
  const parts: string[] = [];

  // Add raw text (purpose/booking text) - most important
  if (tx.rawText) {
    parts.push(tx.rawText);
  }

  // Add counterparty/merchant name
  if (tx.counterparty) {
    parts.push(tx.counterparty);
  } else if (tx.payee) {
    parts.push(tx.payee);
  }

  // Add memo if present and different from rawText
  if (tx.memo && tx.memo !== tx.rawText) {
    parts.push(tx.memo);
  }

  // Combine and mask
  const combined = parts.filter(Boolean).join(' · ');
  return maskSensitiveText(combined);
}

/**
 * Redact a transaction for AI processing.
 * Removes all sensitive information (IBANs, card numbers, emails, long digit sequences)
 * and returns a safe representation.
 */
export function redactTransactionForAi(tx: NormalizedTransaction): RedactedTransaction {
  return {
    description: buildDescription(tx),
    amount: tx.amountCents / 100, // Convert cents to euros
    direction: tx.direction,
    date: tx.bookingDate,
  };
}

