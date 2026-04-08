'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

export function NotifBell() {
    const router = useRouter();
    const { unreadCount } = useNotifications();

    const handleClick = () => {
        router.push('/dashboard/notifications');
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="relative w-9 h-9 rounded-btn flex items-center justify-center bg-kridha-secondary dark:bg-gray-800 hover:bg-kridha-primary/20 transition-colors"
        >
            <Bell className="w-5 h-5 text-kridha-primary" />
            {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 bg-kridha-primary text-white text-label-sm rounded-full flex items-center justify-center font-bold ${unreadCount > 0 ? 'animate-pulse-slow' : ''}`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
}