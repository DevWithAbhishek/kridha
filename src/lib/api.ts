import axios, { AxiosError } from "axios";

// Main client (with interceptor)
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
});

// Clean client (no interceptor) → ONLY for refresh
export const refreshClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (err: unknown) => void;
}> = [];

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/signup") ||
    url.includes("/auth/refresh")
  );
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as typeof error.config & { _retry?: boolean };

    // Only handle 401
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Do not retry twice
    if (config?._retry) {
      return Promise.reject(error);
    }

    // 🔥 Critical: never refresh for auth endpoints
    if (isAuthEndpoint(config?.url)) {
      return Promise.reject(error);
    }

    if (config) config._retry = true;

    // If a refresh is already in-flight → queue
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: () => resolve(api(config!)),
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // 🔥 Use clean client → no interceptor recursion
      await refreshClient.post("/auth/refresh");

      // Resolve queued requests
      failedQueue.forEach((q) => q.resolve());
      failedQueue = [];

      return api(config!);
    } catch (refreshErr) {
      // Reject queued requests
      failedQueue.forEach((q) => q.reject(refreshErr));
      failedQueue = [];

      // Hard stop → logout flow
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }

      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
