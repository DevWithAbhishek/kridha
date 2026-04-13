"use client";
import { useQuery } from "@tanstack/react-query";
import { User } from "@/types/dashboard"; // Update the path as necessary

export function useAuth() {
  const {
    data: user,
    isLoading: loading, // "Is the query currently fetching data for the first time?"
    refetch, // manually re-run query: A function that manually re-executes the queryFn and updates the cached data. Why? - Because React Query caches data aggressively. Forces fresh data → UI updates instantly.
  } = useQuery<User | null>({
    queryKey: ["me"], // Anywhere you use ['me'], same data is shared
    queryFn: async () => {
      const response = await fetch("/api/users/me", {
        credentials: "include", // sends cookies
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      const json = await response.json();
      return json.data;
    },
    staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes: No refetch on re-render -> No unnecessary API calls.
    retry: 1,
  });

  const isLoggedIn = user !== null;
  const isSeller = user?.roles?.includes("SELLER") ?? false;
  const isAdmin = user?.roles?.includes("ADMIN") ?? false;

  return {
    user,
    isLoggedIn,
    isSeller,
    isAdmin,
    loading,
    refetch,
  };
}
