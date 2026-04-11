'use client';

import { Trash2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';

interface DeleteCartItemModalProps {
    open: boolean;
    onClose: () => void;
    itemId: string;
    productName: string;
    onConfirm: () => void;
}

export function DeleteCartItemModal({ open, onClose, itemId, productName, onConfirm }: DeleteCartItemModalProps) {
    async function handleDelete() {
        try {
            await fetch(`/api/cart/${itemId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            onConfirm();
            onClose();
        } catch {
            // Handle error if needed
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay animate-fade-in" />
                <Dialog.Content className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-sm bg-[var(--color-surface)] rounded-t-modal sm:rounded-modal p-6 shadow-modal animate-slide-in-up sm:animate-scale-in z-modal">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-error-light text-error rounded-full flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h2 className="text-h5 font-bold">Cart से हटाएं?</h2>
                        <p className="text-body-sm text-muted">{productName} को cart से हटा दें?</p>
                    </div>
                    <div className="flex flex-col gap-3 mt-6">
                        <Button variant="danger" size="lg" className="w-full" onClick={handleDelete}>
                            हटाएं
                        </Button>
                        <Button variant="ghost" size="lg" className="w-full" onClick={onClose}>
                            रहने दें
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}