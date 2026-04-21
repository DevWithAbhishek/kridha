'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useLangStore } from '@/stores/langStore';

interface Props {
    open: boolean;
    onClose: () => void;
    productId: string;
    productName: string;
    onConfirm: () => void;
}

export function DeleteProductModal({ open, onClose, productId, productName, onConfirm }: Props) {
    const { lang } = useLangStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleDelete() {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/products/${productId}`);
            onConfirm();   // invalidate query
            onClose();
        } catch (err) {
            const e = err as { response?: { status?: number } };
            if (e.response?.status === 409) {
                // Service throws 409 when active orders exist on this product
                setError(lang === 'hi'
                    ? 'इस product पर active orders हैं — पहले orders complete/cancel करें'
                    : 'This product has active orders — complete or cancel them first');
            } else {
                setError(lang === 'hi' ? 'Delete नहीं हुआ — retry करें' : 'Delete failed — please retry');
            }
        } finally {
            setLoading(false);
        }
    }

    function handleOpenChange(open: boolean) {
        if (!open && !loading) onClose(); // don't allow close while delete is in-flight
    }

    return (
        <Dialog.Root open={open} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] rounded-modal shadow-modal z-modal p-6">

                    {/* Icon + header */}
                    <div className="flex flex-col items-center text-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                            <Trash2 className="w-6 h-6 text-error" />
                        </div>
                        <Dialog.Title className="text-h5 font-bold text-[var(--color-text)]">
                            {lang === 'hi' ? 'Product delete करें?' : 'Delete product?'}
                        </Dialog.Title>
                        <Dialog.Description className="text-body-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed">
                            {lang === 'hi'
                                ? <><span className="font-semibold text-[var(--color-text)]">{productName}</span> को permanently delete किया जाएगा। यह undo नहीं होगा।</>
                                : <><span className="font-semibold text-[var(--color-text)]">{productName}</span> will be permanently deleted. This cannot be undone.</>
                            }
                        </Dialog.Description>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error mb-4">
                            {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="flex-1"
                            onClick={onClose}
                            disabled={loading}
                        >
                            {lang === 'hi' ? 'Cancel' : 'Cancel'}
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            size="lg"
                            className="flex-1"
                            onClick={handleDelete}
                            loading={loading}
                            disabled={loading}
                        >
                            {lang === 'hi' ? 'Delete करें' : 'Delete'}
                        </Button>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
