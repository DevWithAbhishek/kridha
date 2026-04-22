'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function RoleToggle() {
    const { isSeller, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    if (loading) return null;

    const isSellerView = pathname.startsWith('/seller');

    const goBuyer = () => router.push('/profile/dashboard');
    const goSeller = () => router.push('/seller/dashboard');

    return (
        <div className="flex items-center bg-kridha-secondary dark:bg-surface-dark rounded-pill p-1 border border-border-DEFAULT dark:border-border-dark min-h-touch">

            {/* Buyer */}
            <button
                onClick={goBuyer}
                className={`px-3 py-1.5 rounded-pill text-label-sm transition-all duration-200 ${!isSellerView
                        ? 'bg-white dark:bg-kridha-primary/20 text-kridha-primary font-semibold shadow-sm'
                        : 'text-muted opacity-60'
                    }`}
            >
                Buyer
            </button>

            {/* Seller */}
            {isSeller && (
                <button
                    onClick={goSeller}
                    className={`px-3 py-1.5 rounded-pill text-label-sm transition-all duration-200 ${isSellerView
                            ? 'bg-white dark:bg-kridha-primary/20 text-kridha-primary font-semibold shadow-sm'
                            : 'text-muted opacity-60'
                        }`}
                >
                    Seller
                </button>
            )}
        </div>
    );
}