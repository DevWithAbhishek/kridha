'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export function LogoutButton() {
    const router = useRouter();
    const queryClient = useQueryClient();

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });

        // 🔥 clear auth cache
        queryClient.invalidateQueries({ queryKey: ['auth'] });

        // 🔥 redirect
        router.push('/');
    }

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition">
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />

                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-surface)] rounded-xl p-6 w-[90vw] max-w-sm z-modal">

                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-semibold">
                            Confirm Logout
                        </Dialog.Title>

                        <Dialog.Close asChild>
                            <button>
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <p className="text-sm text-muted mb-6">
                        Are you sure you want to logout?
                    </p>

                    <div className="flex gap-3">
                        <Dialog.Close asChild>
                            <button className="flex-1 px-4 py-2 rounded-lg border">
                                Cancel
                            </button>
                        </Dialog.Close>

                        <button
                            onClick={handleLogout}
                            className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white"
                        >
                            Logout
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}