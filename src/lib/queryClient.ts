import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — works with Redis 60s TTL
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // important for low connectivity
    },
    mutations: { retry: 0 },
  },
});
