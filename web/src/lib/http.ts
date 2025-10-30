export const API_BASE = (import.meta as any).env?.VITE_API_URL?.replace(/\/+$/, '') || '/api';

export function api(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}


