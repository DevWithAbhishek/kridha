'use client';
import { useQuery } from '@tanstack/react-query';
import { User } from '@/types/dashboard'; // Update the path as necessary

export function useAuth() {
    const { data: user, isLoading: loading, refetch } = useQuery<User | null>({
        queryKey: ['me'],
        queryFn: async () => {
            const response = await fetch('/api/users/me', {
                credentials: 'include',
            });

            if (response.status === 401) {
                return null;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch user');
            }

            const json = await response.json();
            return json.data ?? json;
        },
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    const isLoggedIn = user !== null;
    const isSeller = user?.roles.includes('SELLER') ?? false;
    const isAdmin = user?.roles.includes('ADMIN') ?? false;

    return {
        user,
        isLoggedIn,
        isSeller,
        isAdmin,
        loading,
        refetch,
    };
}