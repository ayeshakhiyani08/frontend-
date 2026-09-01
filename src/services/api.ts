import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
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
