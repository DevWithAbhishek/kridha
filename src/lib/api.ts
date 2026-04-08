import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // HttpOnly cookie auth — never localStorage
  timeout: 15000,
});

// 401 interceptor: auto-refresh kridha_access cookie using kridha_refresh cookie (path=/api/auth)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (err: unknown) => void;
}> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || config?._retry)
      return Promise.reject(error);
    if (config) config._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        failedQueue.push({ resolve: () => resolve(api(config!)), reject }),
      );
    }
    isRefreshing = true;
    try {
      // No body — browser sends kridha_refresh cookie on /api/auth path automatically
      await axios.post("/api/auth/refresh", null, { withCredentials: true });
      failedQueue.forEach((q) => q.resolve());
      failedQueue = [];
      return api(config!);
    } catch (refreshErr) {
      failedQueue.forEach((q) => q.reject(refreshErr));
      failedQueue = [];
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
