'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useFetch } from '@/hooks/useFetch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';

type CartItem = {
    id: string;
    productName: string;
    nameHi: string;
    imageUrl?: string;
    unit: string;
    unitPrice: number;
    quantity: number;
    seller: { storeName: string; city: string };
};

type CartResponse = {
    cartItems: CartItem[];
    summary: { totalAmount: number; sellerCount: number };
};

const fallbackCart: CartResponse = {
    cartItems: [],
    summary: { totalAmount: 0, sellerCount: 0 },
};

function groupBySeller(items: CartItem[]) {
    return items.reduce<Record<string, CartItem[]>>((acc, item) => {
        const key = item.seller.storeName;
        acc[key] = acc[key] ? [...acc[key], item] : [item];
        return acc;
    }, {});
}

export default function CartPage() {
    const { data, loading } = useFetch<CartResponse>('/api/cart', fallbackCart);
    const [cart, setCart] = useState<CartResponse | null>(null);

    const effectiveCart = cart ?? data ?? fallbackCart;

    const sellers = useMemo(() => groupBySeller(effectiveCart.cartItems), [effectiveCart.cartItems]);

    async function updateQuantity(itemId: string, quantity: number) {
        const next = effectiveCart.cartItems.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
        );
        setCart({ ...effectiveCart, cartItems: next });
        try {
            await fetch(`/api/cart/${itemId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity }),
            });
        } catch {
            setCart(data ?? fallbackCart);
        }
    }

    async function removeItem(itemId: string) {
        const next = effectiveCart.cartItems.filter((item) => item.id !== itemId);
        setCart({ ...effectiveCart, cartItems: next });
        try {
            await fetch(`/api/cart/${itemId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch {
            setCart(data ?? fallbackCart);
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

    if (!effectiveCart.cartItems.length) {
        return (
            <div className="py-20">
                <div className="rounded-card border border-dashed border-kridha-primary/30 bg-kridha-secondary/30 p-12 text-center">
                    <div className="text-kridha-primary text-4xl mb-4">🛒</div>
                    <h1 className="text-h4 font-bold mb-2">कोई item नहीं है</h1>
                    <p className="text-body-sm text-[var(--color-text-muted)] mb-6">
                        अपने मनचाहे उत्पाद ब्राउज़ करें
                    </p>
                    <Button variant="primary" size="lg" className="mx-auto">
                        Browse products
                    </Button>
                </div>
            </div>
        );
    }

    const totalItems = effectiveCart.cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = effectiveCart.cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const advance = Math.max(100, Math.min(500, Math.round(totalAmount * 0.05)));

    return (
        <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-10">
            <h1 className="text-h3 font-bold mb-3">आपकी कार्ट</h1>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
                <div className="space-y-6">
                    {Object.entries(sellers).map(([sellerName, items]) => (
                        <section key={sellerName} className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--color-border)]">
                                <h2 className="text-h6 font-semibold">{sellerName}</h2>
                                <p className="text-label-sm text-[var(--color-text-muted)]">{items[0].seller.city}</p>
                            </div>
                            <div className="space-y-4 p-6">
                                {items.map((item) => (
                                    <div key={item.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-4">
                                            <Image
                                                src={item.imageUrl ?? '/images/placeholder.svg'}
                                                alt={item.nameHi}
                                                width={40}
                                                height={40}
                                                className="rounded-lg object-cover"
                                            />
                                            <div>
                                                <div className="font-semibold">{item.nameHi}</div>
                                                <div className="text-label-sm text-[var(--color-text-muted)]">{item.unit}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                className="w-9 h-9 rounded-btn border border-[var(--color-border)]"
                                            >
                                                -
                                            </button>
                                            <span>{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="w-9 h-9 rounded-btn border border-[var(--color-border)]"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="text-kridha-primary font-semibold">₹{item.unitPrice * item.quantity}</div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                className="text-error text-label-sm"
                                            >
                                                Delete
                                            </button>
                                            <button type="button" className="text-kridha-primary text-label-sm">
                                                Save for later
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <aside className="space-y-6">
                    <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                        <h2 className="text-h6 font-semibold mb-4">Order summary</h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm">Items</span>
                                <span className="font-semibold">{totalItems}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm">Total</span>
                                <span className="font-semibold">₹{totalAmount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm">Advance</span>
                                <span className="font-semibold">₹{advance}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-[var(--color-bg)] pt-4">
                        <Button variant="primary" size="lg" className="w-full">
                            Checkout
                        </Button>
                    </div>
                </aside>
            </div>
        </div>
    );
}