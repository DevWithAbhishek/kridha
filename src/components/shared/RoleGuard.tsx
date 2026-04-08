'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { Role } from '@/types/dashboard';

interface RoleGuardProps {
    children: React.ReactNode;
    role: Role;
    redirectTo?: string;
}

export function RoleGuard({ children, role, redirectTo = '/dashboard' }: RoleGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    if (loading) {
        return (
            <div className="space-y-6">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    if (!user || !user.roles.includes(role)) {
        router.replace(redirectTo);
        return null;
    }

    return <>{children}</>;
}