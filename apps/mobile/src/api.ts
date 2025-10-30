import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const api = axios.create({ baseURL: 'http://localhost:4000/api' });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt');
  if (token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  return config;
});


