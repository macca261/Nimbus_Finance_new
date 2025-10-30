export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') || '/api';

export function apiUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  // If using Vite proxy (API_BASE === '/api'), avoid prefixing '/api' twice
  if (API_BASE === '/api') return p;
  return `${API_BASE}${p}`;
}

async function parse(r: Response) {
  let data: any = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const msg = data?.message || `${r.status} ${r.statusText}`;
    const err: any = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const http = {
  get: (path: string, init: RequestInit = {}) =>
    fetch(apiUrl(path), { credentials: 'include', ...init }).then(parse),
  post: (path: string, body?: any, init: RequestInit = {}) =>
    fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(init.headers || {}) },
      body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
      ...init,
    }).then(parse),
};


