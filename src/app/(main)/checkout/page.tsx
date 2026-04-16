'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/hooks/useFetch';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';

type CartItem = {
    id: string;
    quantity: number;
    unitPrice: number;
    seller: { storeName: string };
};

type CartResponse = {
    cartItems: CartItem[];
};

const fallbackCart: CartResponse = { cartItems: [] };

export default function CheckoutPage() {
    const router = useRouter();
    const { data = fallbackCart, loading } = useFetch<CartResponse>('/api/cart', fallbackCart);
    const [placing, setPlacing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const safeData = data ?? fallbackCart;

    const sellerGroups = useMemo(() => {
        return safeData.cartItems.reduce<Record<string, CartItem[]>>((acc, item) => {
            const name = item.seller.storeName;
            acc[name] = acc[name] ? [...acc[name], item] : [item];
            return acc;
        }, {});
    }, [safeData.cartItems]);

    const summary = useMemo(() => {
        const sellers = Object.entries(sellerGroups).map(([seller, items]) => {
            const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
            const advance = Math.max(100, Math.min(500, Math.round(subtotal * 0.05)));
            return { seller, subtotal, advance, itemCount: items.length };
        });

        return {
            sellers,
            totalItems: safeData.cartItems.length,
            totalAdvance: sellers.reduce((sum, seller) => sum + seller.advance, 0),
            totalAmount: sellers.reduce((sum, seller) => sum + seller.subtotal, 0),
        };
    }, [sellerGroups, safeData.cartItems.length]);

    async function placeOrder() {
        setErrorMessage(null);
        setPlacing(true);

        try {
            const res = await fetch('/api/cart/checkout', {
                method: 'POST',
                credentials: 'include',
            });

            const json = await res.json();

            if (!res.ok) {
                if (json.code === 'INSUFFICIENT_STOCK') {
                    setErrorMessage('Some items are out of stock.');
                    return;
                }
                setErrorMessage('Unable to place order.');
                return;
            }

            router.push(`/pay?orderId=${json.orderId}&advance=${json.totalAdvance}&razorpayOrderId=${json.razorpayOrderId}`);
        } catch {
            setErrorMessage('Unable to place order.');
        } finally {
            setPlacing(false);
        }
    }

    if (loading) {
        return (
            <div className="grid gap-6">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <AuthGuard>
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-10">
                <h1 className="text-h3 font-bold mb-3">Checkout</h1>
                <p className="text-body-sm text-[var(--color-text-muted)] mb-8">
                    ऑर्डर बनने के बाद cart खाली हो जाएगा
                </p>

                <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
                    <div className="space-y-6">
                        {Object.entries(sellerGroups).map(([seller, items]) => (
                            <div key={seller} className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-h6 font-semibold">{seller}</h2>
                                        <p className="text-label-sm text-[var(--color-text-muted)]">{items.length} items</p>
                                    </div>
                                    <span className="text-kridha-primary font-semibold">₹{items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)}</span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-label-sm text-[var(--color-text-muted)]">Pickup window</label>
                                        <select className="w-full mt-2 rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3">
                                            <option>Morning slot</option>
                                            <option>Afternoon slot</option>
                                            <option>Evening slot</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-label-sm text-[var(--color-text-muted)]">Pickup date</label>
                                        <input
                                            type="date"
                                            className="w-full mt-2 rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3"
                                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <aside className="space-y-6">
                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                            <h2 className="text-h6 font-semibold mb-4">Order summary</h2>
                            <div className="space-y-3">
                                {summary.sellers.map((seller) => (
                                    <div key={seller.seller} className="rounded-card bg-background-subtle p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-body-sm">{seller.seller}</span>
                                            <span className="font-semibold">₹{seller.subtotal}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-label-sm text-[var(--color-text-muted)]">
                                            <span>{seller.itemCount} items</span>
                                            <span>Advance ₹{seller.advance}</span>
                                        </div>
                                    </div>
                                ))}

                                <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-body-sm">Total</span>
                                        <span className="font-semibold">₹{summary.totalAmount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-body-sm">Total advance</span>
                                        <span className="font-semibold">₹{summary.totalAdvance}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="rounded-card bg-error/10 border border-error text-error p-4">
                                {errorMessage}
                            </div>
                        )}

                        <Button variant="primary" size="lg" className="w-full" loading={placing} onClick={placeOrder}>
                            Place Order
                        </Button>
                    </aside>
                </div>
            </div>
        </AuthGuard>
    );
}