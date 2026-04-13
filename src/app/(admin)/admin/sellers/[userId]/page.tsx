// src/app/(admin)/admin/sellers/[userId]/page.tsx
// Full seller detail for admin review.
// Shows unmasked bank details (admin only — INV-17 exemption).
// Action buttons: VERIFY / REJECT / SUSPEND based on current status + admin role.

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminSellerDetail, useSellerAction } from '@/hooks/useAdminSellers';
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { ProfileStatusBadge, KycStatusBadge } from '@/components/admin/AdminStatusBadge';
import { SellerActionModal } from '@/components/admin/SellerActionModal';
import type { AdminAction, AdminUser } from '@/types/admin';

// For demo — in production inject from admin session store or /api/admin/me
const DEMO_ADMIN: AdminUser = { id: 'admin_01', name: 'Abhishek', role: 'SUPER_ADMIN' };

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, sensitive }: { label: string; value: string | null | undefined; sensitive?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-800/60 last:border-0 gap-4">
      <span className="text-gray-500 text-sm flex-shrink-0 min-w-36">{label}</span>
      <span className={`text-sm text-right break-all font-mono ${sensitive ? 'text-amber-300' : 'text-white'}`}>
        {value ?? <span className="text-gray-600 font-sans">—</span>}
      </span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 bg-gray-800/40 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

export default function SellerDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router     = useRouter();

  const { data: seller, isLoading, error } = useAdminSellerDetail(userId);
  const action = useSellerAction(userId);

  const [modal,   setModal]   = useState<AdminAction | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(a: AdminAction, note?: string) {
    try {
      await action.mutateAsync({ action: a, note });
      setModal(null);
      showToast(
        a === 'VERIFY' ? 'Seller verified successfully.' :
        a === 'REJECT' ? 'Seller rejected.' :
        'Seller suspended.',
        a === 'VERIFY',
      );
    } catch (err) {
      const e = err as { response?: { data?: { code?: string; message?: string } } };
      setModal(null);
      showToast(e.response?.data?.message ?? 'Action failed.', false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <AdminNavbar admin={DEMO_ADMIN} />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-6 bg-gray-800 rounded w-48 mb-8 animate-pulse" />
          <div className="grid lg:grid-cols-3 gap-6">
            {[200, 260, 180].map((h, i) => (
              <div key={i} className={`bg-gray-900 border border-gray-800 rounded-2xl animate-pulse`} style={{ height: h }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Seller not found or session expired.</p>
          <Link href="/admin/sellers" className="text-kridha-primary hover:underline text-sm">
            ← Back to sellers
          </Link>
        </div>
      </div>
    );
  }

  // Which action buttons to show based on current status + admin role
  const canVerify  = seller.profileStatus === 'PENDING';
  const canReject  = seller.profileStatus === 'PENDING';
  const canSuspend = seller.profileStatus === 'VERIFIED' && DEMO_ADMIN.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AdminNavbar admin={DEMO_ADMIN} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all animate-fade-up ${
          toast.ok ? 'bg-green-900 border border-green-700 text-green-200' : 'bg-red-900 border border-red-700 text-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/admin/sellers" className="hover:text-white transition-colors">Sellers</Link>
          <span>/</span>
          <span className="text-white">{seller.storeName}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{seller.storeName}</h1>
              <ProfileStatusBadge status={seller.profileStatus} />
              <KycStatusBadge status={seller.kycStatus} />
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {seller.user.name} · {seller.user.phone} · Registered {new Date(seller.user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {canVerify && (
              <button
                onClick={() => setModal('VERIFY')}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Verify Seller
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setModal('REJECT')}
                className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Reject
              </button>
            )}
            {canSuspend && (
              <button
                onClick={() => setModal('SUSPEND')}
                className="px-4 py-2 border border-red-800 text-red-400 hover:bg-red-950/40 text-sm font-semibold rounded-xl transition-colors"
              >
                Suspend
              </button>
            )}
            {seller.profileStatus === 'VERIFIED' && !canSuspend && (
              <span className="text-xs text-gray-600 self-center">SUPER_ADMIN required to suspend</span>
            )}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left col: Store + KYC */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            <Section title="Store Details">
              <InfoRow label="Store name"     value={seller.storeName} />
              <InfoRow label="Street"         value={seller.street} />
              {seller.line2    && <InfoRow label="Line 2"       value={seller.line2} />}
              {seller.landmark && <InfoRow label="Landmark"     value={seller.landmark} />}
              <InfoRow label="City"           value={seller.city} />
              <InfoRow label="State"          value={seller.state} />
              <InfoRow label="PIN Code"       value={seller.pinCode} />
              <InfoRow label="Business type"  value={seller.businessType} />
            </Section>

            <Section title="KYC Documents">
              <InfoRow label="PAN"            value={seller.panNumber} />
              <InfoRow label="GST"            value={seller.gstNumber ?? 'Not provided'} />
              {seller.storeImages.length > 0 && (
                <div className="py-3">
                  <p className="text-gray-500 text-sm mb-2">Store images</p>
                  <div className="flex gap-2 flex-wrap">
                    {seller.storeImages.map((img, i) => (
                      <a key={i} href={img.url} target="_blank" rel="noreferrer"
                        className="w-20 h-20 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`Store ${i+1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Bank details — UNMASKED for admin */}
            <Section title="Bank Details (Admin Only)">
              <div className="flex items-center gap-2 py-2 mb-1">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-amber-400 text-xs font-medium">Sensitive — visible to admins only. Handle with care.</p>
              </div>
              <InfoRow label="Account holder" value={seller.accountHolderName} />
              <InfoRow label="Account no."    value={seller.accountNumber} sensitive />
              <InfoRow label="IFSC"           value={seller.ifscCode}      sensitive />
              <InfoRow label="Bank"           value={seller.bankName} />
              <InfoRow label="Bank verified"  value={seller.bankVerified ? 'Yes' : 'No — pending'} />
            </Section>
          </div>

          {/* Right col: Metrics + quick stats */}
          <div className="flex flex-col gap-6">

            <Section title="Seller Metrics">
              <InfoRow label="Rating"         value={seller.sellerRating > 0 ? `${seller.sellerRating.toFixed(1)} / 5` : 'No ratings yet'} />
              <InfoRow label="Reviews"        value={String(seller.reliabilityScore)} />
              <InfoRow label="Reliability"    value={`${seller.reliabilityScore}%`} />
            </Section>

            <Section title="Status Timeline">
              <div className="py-3 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    seller.profileStatus === 'PENDING' ? 'bg-amber-400 animate-pulse' :
                    seller.profileStatus === 'VERIFIED' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="text-gray-300">Profile: <span className="text-white font-medium">{seller.profileStatus}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    seller.kycStatus === 'PENDING' ? 'bg-gray-400' :
                    seller.kycStatus === 'VERIFIED' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="text-gray-300">KYC: <span className="text-white font-medium">{seller.kycStatus}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${seller.bankVerified ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-gray-300">Bank: <span className="text-white font-medium">{seller.bankVerified ? 'Verified' : 'Pending'}</span></span>
                </div>
              </div>
            </Section>

            {/* Audit log link */}
            <Link
              href={`/admin/audit?targetId=${userId}`}
              className="flex items-center justify-between px-5 py-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors group"
            >
              <div>
                <p className="text-sm font-semibold text-white">Audit Log</p>
                <p className="text-xs text-gray-500 mt-0.5">View all admin actions on this seller</p>
              </div>
              <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </main>

      {/* Action modal */}
      {modal && (
        <SellerActionModal
          action={modal}
          storeName={seller.storeName}
          loading={action.isPending}
          onConfirm={note => handleAction(modal, note)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
