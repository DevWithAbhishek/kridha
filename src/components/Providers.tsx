'use client';

import { useState } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from "next-themes";
import { IntlClientProvider } from "@/components/layout/IntlClientProvider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

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
                    <Toaster
                        position="bottom-center"
                        richColors               // uses semantic colors (green/red/amber/blue)
                        expand={false}           // stacks toasts — better on small screens
                        visibleToasts={3}        // max visible at once (slow network: avoid pile-up)
                        closeButton             // always show × for accessibility
                        toastOptions={{
                            style: { fontFamily: "Inter, Noto Sans Devanagari, sans-serif" },
                            classNames: {
                                toast: "rounded-xl shadow-md-dark text-body-sm", title: "font-medium",
                                actionButton: "font-medium text-label-sm",
                            },
                        }} />
                </IntlClientProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}