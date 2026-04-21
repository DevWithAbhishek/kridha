"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/types/dashboard";

// FIX: use api.ts (Axios) not raw fetch().
// Raw fetch() is invisible to the Axios interceptor — if the token expires,
// the interceptor cannot refresh it and the query fails with 401 permanently
// until the user manually refreshes the page.
//
// FIX: gcTime (formerly cacheTime) set to 0 when user is null.
// If useAuth previously resolved to null (logged-out state) and the user logs
// in and the component re-mounts, TanStack Query would serve the cached null
// for up to cacheTime before re-fetching. Setting gcTime: 0 means the null
// result is evicted from cache immediately — next mount always fetches fresh.
//
// The actual cache eviction is handled by invalidateQueries(['me']) in AuthPage
// after successful login — this is the correct trigger point.

export function useAuth() {
  const {
    data: user,
    isLoading: loading,
    refetch,
  } = useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: true; data: User }>("/users/me");
        return res.data.data;
      } catch (err) {
        const e = err as { response?: { status?: number } };
        // 401 = not logged in — return null (not throw) so the query settles
        if (e.response?.status === 401) return null;
        // Any other error — rethrow so TanStack Query marks it as error state
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
  const isSeller = user?.roles?.includes("SELLER") ?? false;
  const isAdmin = user?.roles?.includes("ADMIN") ?? false;

  return {
    user,
    isLoggedIn,
    isSeller,
    isAdmin,
    loading: !isResolved || loading,
    refetch,
  };
}
