// src/lib/adminApi.ts
// Separate Axios instance for admin routes.
// Sends kridha_admin cookie (path=/api/admin) — not kridha_access.
// On 401: redirect to /admin/login (not /login).
// No shared state with the user api.ts instance.

import axios, { AxiosError } from 'axios';

export const adminApi = axios.create({
  baseURL:         '/api/admin',
  withCredentials: true,  // sends kridha_admin cookie
  timeout:         15000,
});

adminApi.interceptors.response.use(
  res => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  },
);
