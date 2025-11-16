export type CategorySource = 'rule' | 'ml' | 'user' | 'ai' | 'fallback' | 'unknown';

export interface NormalizationInput {
  text: string;
  description?: string | null;
  merchant?: string | null;
  transaction?: Record<string, unknown> | null;
}

export interface NormalizationResult {
  normalizedText: string;
  normalizedDescription: string;
  merchant?: string;
  categoryId?: string | null;
  categorySource?: CategorySource;
  // You can extend with more fields later
}

// Minimal, deterministic pass-through so imports never 500
export function applyRules(
  input: NormalizationInput,
  ruleset?: unknown
): NormalizationResult {
  const baseText = `${input.text ?? ''}`.trim();
  return {
    normalizedText: baseText,
    normalizedDescription: `${input.description ?? baseText}`.trim(),
    merchant: input.merchant ?? undefined,
    categoryId: null,
    categorySource: 'unknown',
  };
}

