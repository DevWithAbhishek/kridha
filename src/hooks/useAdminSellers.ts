// src/hooks/useAdminSellers.ts
// Fetches and manages seller list for admin panel.
// Separate TanStack Query instance keyed to admin namespace.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/adminApi';
import type {
  PaginatedSellers,
  AdminSellerDetail,
  SellerStatus,
  AdminAction,
} from '@/types/admin';

// ── Seller list ────────────────────────────────────────────────────────────
export function useAdminSellers(status?: SellerStatus, page = 1) {
  return useQuery<PaginatedSellers>({
    queryKey: ['admin', 'sellers', status, page],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('page', String(page));
      const res = await adminApi.get<{ success: true; data: PaginatedSellers }>(
        `/sellers?${params}`,
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

// ── Single seller detail ───────────────────────────────────────────────────
export function useAdminSellerDetail(userId: string) {
  return useQuery<AdminSellerDetail>({
    queryKey: ['admin', 'seller', userId],
    queryFn:  async () => {
      const res = await adminApi.get<{ success: true; data: { seller: AdminSellerDetail } }>(
        `/sellers/${userId}`,
      );
      return res.data.data.seller;
    },
    staleTime: 0,  // always fresh for detail view — admin needs latest state
  });
}

// ── Action mutation (VERIFY / REJECT / SUSPEND) ────────────────────────────
export function useSellerAction(userId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ action, note }: { action: AdminAction; note?: string }) =>
      adminApi.patch(`/sellers/${userId}`, { action, note }),

    onSuccess: () => {
      // Invalidate both list and detail so UI updates immediately
      qc.invalidateQueries({ queryKey: ['admin', 'sellers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'seller', userId] });
    },
  });
}
