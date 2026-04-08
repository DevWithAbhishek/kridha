'use client';

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlClientProvider } from "@/components/layout/IntlClientProvider";

// QueryClient singleton for React Query
let queryClientInstance: QueryClient | null = null;

function getQueryClient() {
    if (!queryClientInstance) {
        queryClientInstance = new QueryClient();
    }
    return queryClientInstance;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient();

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                <IntlClientProvider>
                    {children}
                </IntlClientProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}