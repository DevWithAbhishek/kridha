'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useLangStore } from '@/stores/langStore';
import hiMessages from '@/messages/hi.json';
import enMessages from '@/messages/en.json';
import { useEffect } from 'react';
import { startTokenRefresher, stopTokenRefresher } from '@/lib/tokenRefresher';

interface IntlClientProviderProps {
    children: ReactNode;
}

export function IntlClientProvider({ children }: IntlClientProviderProps) {
    const { lang } = useLangStore();
    const messages = lang === 'hi' ? hiMessages : enMessages;
    useEffect(() => {
        startTokenRefresher();
        return () => stopTokenRefresher();
    }, [])

    return (
        <NextIntlClientProvider locale={lang} messages={messages} timeZone='Asia/Kolkata'>
            {children}
        </NextIntlClientProvider>
    );
}