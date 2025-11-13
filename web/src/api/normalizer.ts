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

export interface NormalizerTestInput {
  text: string;
  counterparty?: string;
}

export interface NormalizerResult {
  merchant?: string;
  categoryHint?: string | null;
  matchedRuleId?: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateRuleInput {
  matcher: RuleMatcher;
  pattern: string;
  normalizeTo: string;
  priority?: number;
  is_active?: boolean;
  categoryHint?: string | null;
  notes?: string | null;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

async function parseJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function handleResponse<T>(
  res: Response,
  extractor: (body: any) => T | undefined,
  fallbackError = 'Request failed',
): Promise<ApiResult<T>> {
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const errorMessage =
      (body && (body.error ?? body.message)) ?? res.statusText ?? fallbackError;
    return { ok: false, error: String(errorMessage || fallbackError) };
  }
  const data = extractor(body);
  if (data === undefined) {
    return { ok: false, error: fallbackError };
  }
  return { ok: true, data };
}

export async function listNormalizationRules(): Promise<ApiResult<NormalizationRule[]>> {
  try {
    const res = await fetch('/api/normalizer/rules', { method: 'GET' });
    return handleResponse(res, body => (Array.isArray(body?.rules) ? body.rules : []));
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}

export async function createNormalizationRule(
  input: CreateRuleInput,
): Promise<ApiResult<NormalizationRule>> {
  try {
    const res = await fetch('/api/normalizer/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(
      res,
      body => (body?.rule as NormalizationRule | undefined),
      'Failed to create rule',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}

export async function updateNormalizationRule(
  id: string,
  input: UpdateRuleInput,
): Promise<ApiResult<NormalizationRule>> {
  try {
    const res = await fetch(`/api/normalizer/rules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(
      res,
      body => (body?.rule as NormalizationRule | undefined),
      'Failed to update rule',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}

export async function deleteNormalizationRules(ids: string[]): Promise<ApiResult<number>> {
  try {
    const res = await fetch('/api/normalizer/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return handleResponse(
      res,
      body => (typeof body?.deleted === 'number' ? body.deleted : 0),
      'Failed to delete rules',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}

export async function testNormalizer(
  input: NormalizerTestInput,
): Promise<ApiResult<NormalizerResult>> {
  try {
    const res = await fetch('/api/normalizer/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(
      res,
      body => (body?.result as NormalizerResult | undefined) ?? {},
      'Failed to test normalizer',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}


