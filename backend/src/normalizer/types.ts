export type RuleMatcher = 'contains' | 'regex' | 'startsWith' | 'equals';

export interface NormalizationRule {
  id: string;
  is_active: boolean;
  priority: number;
  matcher: RuleMatcher;
  pattern: string;
  normalizeTo: string;
  categoryHint?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizerResult {
  merchant?: string;
  categoryHint?: string | null;
  matchedRuleId?: string;
}


