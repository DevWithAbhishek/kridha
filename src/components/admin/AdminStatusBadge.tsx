// src/components/admin/AdminStatusBadge.tsx
import type { SellerStatus, KycStatus } from '@/types/admin';

const PROFILE_CONFIG: Record<SellerStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pending',     cls: 'bg-amber-950/40 text-amber-300 border-amber-800' },
  VERIFIED:    { label: 'Verified',    cls: 'bg-green-950/40 text-green-300 border-green-800'  },
  DEACTIVATED: { label: 'Deactivated', cls: 'bg-red-950/40   text-red-300   border-red-800'    },
};

const KYC_CONFIG: Record<KycStatus, { label: string; cls: string }> = {
  PENDING:  { label: 'KYC Pending',  cls: 'bg-gray-800 text-gray-400 border-gray-700' },
  VERIFIED: { label: 'KYC Verified', cls: 'bg-green-950/40 text-green-300 border-green-800' },
  REJECTED: { label: 'KYC Rejected', cls: 'bg-red-950/40 text-red-300 border-red-800' },
};

export function ProfileStatusBadge({ status }: { status: SellerStatus }) {
  const { label, cls } = PROFILE_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'VERIFIED' ? 'bg-green-400' : status === 'PENDING' ? 'bg-amber-400' : 'bg-red-400'
      }`} />
      {label}
    </span>
  );
}

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const { label, cls } = KYC_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
