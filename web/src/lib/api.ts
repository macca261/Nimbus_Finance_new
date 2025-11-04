import axios, { AxiosRequestConfig } from "axios";

// Base client
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: false,
});

// Default export so `import api from '@/lib/api'` works
export default api;

// Generic helpers so `import { get, post } ...` works
export async function get<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.get<T>(url, config);
  return res.data;
}
export async function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
  const res = await api.post<T>(url, data, config);
  return res.data;
}

// ---- Specific helpers the UI expects (safe no-throw wrappers) ----

// Categories
export const categoriesList = () => get("/categories").catch(() => []);
export const categoriesBreakdown = (params: { from?: string; to?: string } = {}) =>
  api.get("/categories/breakdown", { params }).then(r => r.data).catch(() => ({ total: 0, buckets: [] }));

// Providers (these routes may not exist yet; return empty instead of crashing UI)
export const providerAccounts = () => get("/providers/accounts").catch(() => []);
export const providerConnect = (provider: string) =>
  post(`/providers/${provider}/connect`, {}).catch(() => ({ ok: false }));
export const providerSync = (provider: string) =>
  post(`/providers/${provider}/sync`, {}).catch(() => ({ ok: false }));

// Auth (Login/Signup pages import { post })
export const login = (email: string, password: string) =>
  post("/auth/login", { email, password });
export const signup = (email: string, password: string) =>
  post("/auth/signup", { email, password });

// ---- Summary + Dev helpers for Dashboard ----
const base = '/api';
export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${base}${path}`);
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return r.json() as Promise<T>;
}

export const apiSummary = {
  balance: (month?: string) => {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return getJSON<{ data: { balanceCents: number; currency: string; month?: string; monthNetCents?: number } }>(`/summary/balance${q}`).then(j => j.data);
  },
  month:   (month?: string) => getJSON<{ month: string|null; incomeCents:number; expenseCents:number }>(`/summary/month${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  cats:    (month?: string) => {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return getJSON<{ data:{category:string; amountCents:number}[] }>(`/summary/categories${q}`).then(j => ({ items: j.data.map(i => ({ category: i.category, spendCents: i.amountCents })) }));
  },
  categories: (month?: string) => {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return getJSON<{ data:{category:string; amountCents:number}[] }>(`/summary/categories${q}`).then(j => ({ items: j.data.map(i => ({ category: i.category, spendCents: i.amountCents })) }));
  },
  months:  (months = 6) => getJSON<{ data:{month:string; incomeCents:number; expenseCents:number}[] }>(`/summary/monthly?months=${months}`).then(j => j.data),
  months6: () => getJSON<{ baseMonth: string|null; series:{label:string; incomeCents:number; expenseCents:number}[] }>(`/summary/monthly-6`),
};

// Dashboard-specific fetch wrappers - thin fetch helpers
async function apiFetch(path: string) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export const getBalance = () => apiFetch('/api/summary/balance');
export const getMonthly = () => apiFetch('/api/summary/monthly');
export const getCategories = () => apiFetch('/api/summary/categories');
export const getTransactions = (limit = 10) => apiFetch(`/api/transactions?limit=${limit}`);
export const getAchievements = () => apiFetch('/api/achievements');

export const apiDev = {
  reset: () => fetch(`${base}/dev/reset`, { method:'POST' }).then(r => r.json()),
};

export type Achievement = {
  id: 'no-fees' | 'saver-500' | 'groceries-under-200' | 'streak-7';
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  target?: number;
  current?: number;
};
