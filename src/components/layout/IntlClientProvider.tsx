'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useLangStore } from '@/stores/langStore';
import hiMessages from '@/messages/hi.json';
import enMessages from '@/messages/en.json';

interface IntlClientProviderProps {
    children: ReactNode;
}

export function IntlClientProvider({ children }: IntlClientProviderProps) {
    const { lang } = useLangStore();
    const messages = lang === 'hi' ? hiMessages : enMessages;

    return (
        <NextIntlClientProvider locale={lang} messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}