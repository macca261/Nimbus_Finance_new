import { api as url, api } from './http';
export { api }; // re-export for callers

export async function uploadCsv(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(url('/api/imports/csv'), { method: 'POST', body: fd, credentials: 'include' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `Upload failed (${r.status})`);
  return data;
}

export async function providerAccounts() {
  const r = await fetch(url('/api/providers/accounts'), { credentials: 'include' });
  return r.json();
}

export async function providerConnect(name: string) {
  const r = await fetch(url(`/api/providers/${name}/connect`), { method: 'POST', credentials: 'include' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `Connect failed (${r.status})`);
  return data;
}

export async function providerSync(id: string) {
  const r = await fetch(url(`/api/providers/${id}/sync`), { method: 'POST', credentials: 'include' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `Sync failed (${r.status})`);
  return data;
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


