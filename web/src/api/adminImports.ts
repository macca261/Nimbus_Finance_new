import type { ApiResult } from './normalizer';

export interface AdminImportRun {
  id: number;
  createdAt: string;
  source: string;
  rowCount: number;
  insertedCount: number;
  profileId: string;
  fileName: string;
  confidence?: number;
  warnings?: string[];
  batchId?: string | null;
}

export interface DeleteImportsResult {
  deletedImports: number;
  deletedTransactions: number;
}

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

export async function fetchAdminImports(
  params: { limit?: number } = {},
): Promise<ApiResult<AdminImportRun[]>> {
  try {
    const query =
      typeof params.limit === 'number' && Number.isFinite(params.limit)
        ? `?limit=${encodeURIComponent(String(params.limit))}`
        : '';
    const res = await fetch(`/api/admin/imports${query}`, { method: 'GET' });
    return handleResponse(
      res,
      body => (Array.isArray(body?.imports) ? (body.imports as AdminImportRun[]) : []),
      'Failed to load imports',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}

export async function deleteAdminImports(
  ids: Array<number | string>,
): Promise<ApiResult<DeleteImportsResult>> {
  try {
    const res = await fetch('/api/admin/imports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return handleResponse(
      res,
      body =>
        body && typeof body.deletedImports === 'number'
          ? ({
              deletedImports: body.deletedImports,
              deletedTransactions: body.deletedTransactions ?? 0,
            } satisfies DeleteImportsResult)
          : { deletedImports: 0, deletedTransactions: 0 },
      'Failed to delete imports',
    );
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? 'Network error' };
  }
}


