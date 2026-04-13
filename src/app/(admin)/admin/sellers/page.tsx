// src/app/(admin)/admin/sellers/page.tsx
// Admin seller list — filter by status, paginate, click to view detail.
// All fetches go to /api/admin/sellers via adminApi (kridha_admin cookie).

'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminSellers } from '@/hooks/useAdminSellers';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { ProfileStatusBadge, KycStatusBadge } from '@/components/admin/AdminStatusBadge';
import type { SellerStatus, AdminUser } from '@/types/admin';

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800 animate-pulse">
      {[140, 80, 60, 90, 90, 60, 80].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-gray-800 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Status filter pill ────────────────────────────────────────────────────────
const FILTERS: { label: string; value?: SellerStatus }[] = [
  { label: 'All' },
  { label: 'Pending',     value: 'PENDING'     },
  { label: 'Verified',    value: 'VERIFIED'    },
  { label: 'Deactivated', value: 'DEACTIVATED' },
];

// ── Hard-coded admin for demo. In production: read from queryClient or a /api/admin/me endpoint.
const DEMO_ADMIN: AdminUser = { id: 'admin_01', name: 'Abhishek', role: 'SUPER_ADMIN' };

export default function AdminSellersPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const statusParam = searchParams.get('status') as SellerStatus | null;
  const pageParam   = parseInt(searchParams.get('page') ?? '1', 10);

  const [status, setStatus] = useState<SellerStatus | undefined>(statusParam ?? undefined);
  const [page,   setPage]   = useState(pageParam);

  const { data, isLoading, error } = useAdminSellers(status, page);

  function applyFilter(s?: SellerStatus) {
    setStatus(s);
    setPage(1);
    const params = new URLSearchParams();
    if (s) params.set('status', s);
    router.replace(`/admin/sellers?${params}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AdminNavbar admin={DEMO_ADMIN} />

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Sellers</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {data ? `${data.total} total` : '—'}
            </p>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => applyFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                status === f.value
                  ? 'bg-kridha-primary border-kridha-primary text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm mb-6">
            Failed to load sellers. Check your session.
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 border-b border-gray-800">
              <tr>
                {['Store', 'Owner', 'City', 'Profile Status', 'KYC', 'Rating', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {isLoading && [...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
              {!isLoading && data?.sellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                    No sellers found.
                  </td>
                </tr>
              )}
              {data?.sellers.map(seller => (
                <tr
                  key={seller.userId}
                  className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/sellers/${seller.userId}`)}
                >
                  <td className="px-4 py-3.5 font-semibold text-white">{seller.storeName}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-white">{seller.user.name}</p>
                    <p className="text-gray-500 text-xs">{seller.user.phone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-gray-300">{seller.city}</td>
                  <td className="px-4 py-3.5"><ProfileStatusBadge status={seller.profileStatus} /></td>
                  <td className="px-4 py-3.5"><KycStatusBadge status={seller.kycStatus} /></td>
                  <td className="px-4 py-3.5 text-gray-300">
                    {seller.sellerRating > 0 ? `${seller.sellerRating.toFixed(1)} ★` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">
                    {new Date(seller.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > data.limit && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!data.hasMore}
                className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
