"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SubOrder, PaginatedResponse } from "@/types/dashboard";

interface UseOrdersProps {
  role?: "buyer" | "seller";
  status?: string;
  page?: number;
}

export function useOrders({ role, status, page = 1 }: UseOrdersProps = {}) {
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["orders", role, status, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (role) params.append("role", role);
      if (status) params.append("status", status);
      params.append("page", page.toString());
      const res = await api.get(`/orders?${params}`);
      return res.data as PaginatedResponse<SubOrder>;
    },
    refetchInterval: (query) => {
      const data = query.state.data as PaginatedResponse<SubOrder> | undefined;
      const hasActive = data?.items?.some(
        (order) => order.status === "PENDING" || order.status === "CONFIRMED",
      );

      return hasActive ? 30_000 : false;
    },
  });

  return {
    subOrders: data?.items ?? [],
    loading,
    error,
    meta: data?.meta ?? null,
    refetch,
  };
}
