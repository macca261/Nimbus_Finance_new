import axios from 'axios';

const base = (import.meta as any).env?.VITE_API_URL || '/api';
export const api = axios.create({ baseURL: base + (base.endsWith('/api') ? '' : '/api') });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


