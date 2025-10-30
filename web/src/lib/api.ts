import { http, apiUrl } from './http';
export const api = apiUrl;
export { http, apiUrl };

export async function uploadCsv(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/api/imports/csv', fd);
}

export async function providerAccounts() {
  return http.get('/api/providers/accounts');
}

export async function providerConnect(name: string) {
  return http.post(`/api/providers/${name}/connect`);
}

export async function providerSync(id: string) {
  return http.post(`/api/providers/${id}/sync`);
}

export async function categoriesList() {
  return http.get('/api/categories');
}

export async function categoriesBreakdown(from: string, to: string) {
  return http.get(`/api/categories/breakdown?from=${from}&to=${to}`);
}

export async function recentTransactions(limit = 20) {
  return http.get(`/api/transactions?limit=${limit}`);
}

function toQuery(params?: Record<string, any>) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null) usp.append(k, String(v)); });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export async function get(path: string, params?: Record<string, any>) {
  const r = await fetch(url(`${path}${toQuery(params)}`), { credentials: 'include' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `Request failed (${r.status})`);
  return { data };
}

export async function post(path: string, body?: any) {
  const r = await fetch(url(path), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `Request failed (${r.status})`);
  return { data };
}


