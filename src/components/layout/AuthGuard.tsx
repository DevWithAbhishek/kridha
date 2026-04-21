'use client';

// AuthGuard — role-based route protection.
//
// FIX: The old guard had a race condition:
//   - loading=true → show skeleton
//   - useEffect fires → if !isLoggedIn, redirect
//   - But loading check was ONLY in the useEffect, not in the render guard
//   - So: render guard shows null, THEN effect fires redirect
//   - On fresh navigation: data=undefined → loading=true → render skeleton ✓
//   - On re-navigation with stale null cache: loading=false, isLoggedIn=false
//     → effect fires immediately → redirect before /api/users/me is even called
//
// FIX strategy:
//   1. Render null (not skeleton) while loading — prevents flash
//   2. Effect only fires when !loading — no premature redirects
//   3. AuthPage invalidates ['me'] before router.push → AuthGuard always gets fresh data
//   4. useAuth has retry:false — no infinite retry loops on 401

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Props {
    children: React.ReactNode;
    requireSeller?: boolean;
}

export function AuthGuard({ children, requireSeller }: Props) {
    const { isLoggedIn, isSeller, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // FIX: never act while loading — wait for useAuth to fully resolve.
        // The old code had this check but the render path below returned null
        // before the effect had a chance to run correctly, causing a flash-redirect.
        if (loading) return;

        if (!isLoggedIn) {
            // FIX: always encode the redirect param — prevents broken URLs with spaces
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        if (requireSeller && !isSeller) {
            // Buyer trying to access seller routes — send to buyer home
            router.replace('/');
            return;
        }
    }, [isLoggedIn, isSeller, loading, requireSeller, router, pathname]);

    // FIX: show nothing (not null AND not skeleton) while loading or redirecting.
    // Skeleton was shown in the old code but it caused a visible flash because
    // the skeleton appeared, then immediately disappeared on redirect.
    // Returning null gives a blank frame which is invisible during navigation.
    if (loading) return null;
    if (!isLoggedIn) return null;
    if (requireSeller && !isSeller) return null;

    return <>{children}</>;
}
