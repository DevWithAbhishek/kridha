'use client';
import { useState, useEffect } from 'react';
import { useLangStore } from '@/stores/langStore';

export function OfflineBanner() {
    const { lang } = useLangStore();
    const [isOffline, setIsOffline] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Set initial state based on navigator.onLine
        const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
        updateOnlineStatus();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (isOffline) {
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => setShowBanner(false), 0);
            return () => clearTimeout(timer);
        }
    }, [isOffline]);

    if (!showBanner) return null;

    const message = lang === 'hi'
        ? 'इंटरनेट नहीं है — पुरानी जानकारी दिखाई जा रही है'
        : 'No internet — showing cached data';

    return (
        <div className="fixed bottom-0 left-0 right-0 z-toast bg-error text-white text-center py-2 text-label-sm animate-slide-in-up">
            {message}
        </div>
    );
}