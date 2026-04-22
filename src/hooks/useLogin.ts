"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type AuthUser = {
  userId: string;
  roles: string[];
};

export function useLogin() {
  const {
    data: user,
    isLoading: loading,
    refetch,
  } = useQuery<AuthUser | null>({
    queryKey: ["auth"],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: true; data: AuthUser }>(
          "/auth/me",
        );
        return res.data.data;
      } catch (err) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min — avoids re-fetch on every nav
    retry: false, // CRITICAL: no retry loops on 401
    refetchOnWindowFocus: false,
    refetchOnMount: true, // re-fetch when component mounts fresh
  });

  const isResolved = user !== undefined;
  const isLoggedIn = user !== null && isResolved;

  return {
    user,
    isLoggedIn,
    loading: !isResolved || loading,
    refetch,
  };
}
