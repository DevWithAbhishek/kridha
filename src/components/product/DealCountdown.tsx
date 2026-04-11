'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface DealCountdownProps {
    expiresAt: string;
}

export function DealCountdown({ expiresAt }: DealCountdownProps) {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

    useEffect(() => {
        const updateCountdown = () => {
            const now = Date.now();
            const expiry = new Date(expiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft(null);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    if (!timeLeft) return null;

    const isUrgent = timeLeft.hours < 2;
    const text = timeLeft.days > 0
        ? `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`
        : timeLeft.hours > 0
            ? `${timeLeft.hours}h ${timeLeft.minutes}m`
            : timeLeft.minutes > 0
                ? `${timeLeft.minutes}m ${timeLeft.seconds}s`
                : `${timeLeft.seconds}s`;

    return (
        <div className={`inline-flex items-center gap-1.5 bg-kridha-accent/15 dark:bg-kridha-accent/10 rounded-pill px-2.5 py-1 ${isUrgent ? 'text-error' : ''}`}>
            <Clock className="w-3.5 h-3.5 text-kridha-accent" />
            <span className="text-label-sm font-semibold text-yellow-800 dark:text-yellow-200">
                {text} बाकी
            </span>
        </div>
    );
}