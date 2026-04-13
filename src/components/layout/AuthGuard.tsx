'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface AuthGuardProps {
    children: React.ReactNode;
    requireSeller?: boolean;
}

export function AuthGuard({ children, requireSeller }: AuthGuardProps) {
    const { isLoggedIn, isSeller, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;
        // console.log("Is Seller: " + isSeller);

        if (!isLoggedIn) {
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        if (requireSeller && !isSeller) {
            router.push('/?seller=false');
            return;
        }
    }, [isLoggedIn, isSeller, loading, requireSeller, router, pathname]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="space-y-4">
                    <div>Loading...</div>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (!isLoggedIn || (requireSeller && !isSeller)) {
        return null; // Prevent flash
    }

    return <>{children}</>;
}