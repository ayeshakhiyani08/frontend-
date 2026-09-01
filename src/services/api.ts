import axios from 'axios';

export const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5001/api';
  }

  if (hostname.includes('github.io')) {
    return 'https://backend-1.onrender.com/api';
  }

  return 'http://localhost:5001/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('supportflow-token');

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const authApi = {
  login: (payload: { email: string; password: string; role: string }) => api.post('/auth/login', payload),
  register: (payload: { name: string; email: string; password: string; role: string }) => api.post('/auth/register', payload),
};

export const ticketsApi = {
  fetchAll: () => api.get('/complaints'),
  create: (payload: Record<string, unknown>) => api.post('/complaints', payload),
};
