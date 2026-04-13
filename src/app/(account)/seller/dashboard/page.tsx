'use client';

import { useTranslations } from 'next-intl';
import { useFetch } from '@/hooks/useFetch';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { SellerStatRow } from '@/components/account/SellerStatRow';
import SellerOrderRow from '@/components/account/SellerOrderRow';
import NotifPanel from '@/components/account/NotifPanel';
import ReliabilityDonut from '@/components/account/ReliabilityDonut';
import { DUMMY_SELLER_ORDERS, DUMMY_PRODUCTS, DUMMY_SELLER_PROFILE, DUMMY_NOTIFICATIONS } from '@/data/dummy';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Notification, Product, SellerProfile, SubOrder } from '@/types/dashboard';
import { useState } from 'react';

type NotificationResponse = {
    notifications: Notification[];
    unreadCount: number;
};

export default function SellerDashboardPage() {
    const t = useTranslations('errors');
    const {
        data: orders = DUMMY_SELLER_ORDERS,
        loading: ordersLoading,
        refetch: refetchOrders,
    } = useFetch<SubOrder[]>('/api/orders?limit=20', DUMMY_SELLER_ORDERS);
    const { data: products = DUMMY_PRODUCTS, loading: productsLoading } = useFetch<Product[]>('/api/products/mine?limit=20', DUMMY_PRODUCTS);
    const { data: profile = DUMMY_SELLER_PROFILE, loading: profileLoading } = useFetch<SellerProfile>('/api/sellers/profile', DUMMY_SELLER_PROFILE);
    const {
        data: notifData = {
            notifications: DUMMY_NOTIFICATIONS,
            unreadCount: 0,
        },
        loading: notificationsLoading,
    } = useFetch<NotificationResponse>(
        "/api/notifications?limit=10",
        {
            notifications: DUMMY_NOTIFICATIONS,
            unreadCount: 0,
        }
    );
    async function handleRequestPayment(id: string) {
        await fetch(`/api/orders/${id}/request-payment`, {
            method: "POST",
            credentials: "include",
        });
    }

    async function handleVerifyOtp(id: string) {
        await fetch(`/api/orders/${id}/verify-otp`, {
            method: "POST",
            credentials: "include",
        });
    }
    const loading = ordersLoading || productsLoading || profileLoading || notificationsLoading;
    const [size, setSize] = useState<"sm" | "md" | "lg">("md");
    if (loading) {
        return (
            <div className="grid gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <AuthGuard requireSeller>
            <div className="space-y-8">
                <section className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <SellerStatRow orders={orders} products={products} profile={profile} />
                    </div>
                    <aside className="space-y-6">
                        <ReliabilityDonut rating={profile.sellerRating} size={size} />
                        <NotifPanel
                            notifications={notifData.notifications}
                            unreadCount={notifData.unreadCount}
                            onMarkAll={() => {
                                // TODO: call mark-all API
                            }}
                        />
                    </aside>
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                            <h2 className="text-h5 font-semibold mb-4">Active orders</h2>
                            <div className="space-y-4">
                                {orders.map((order) => (
                                    <SellerOrderRow
                                        key={order.id}
                                        order={order}
                                        onRequestPayment={handleRequestPayment}
                                        onVerifyOtp={handleVerifyOtp}
                                        onRefetch={refetchOrders}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                            <h2 className="text-h5 font-semibold mb-4">Products</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left">
                                    <thead className="bg-background-subtle">
                                        <tr>
                                            <th className="px-4 py-3 text-label-sm text-[var(--color-text-muted)]">Product</th>
                                            <th className="px-4 py-3 text-label-sm text-[var(--color-text-muted)]">Price</th>
                                            <th className="px-4 py-3 text-label-sm text-[var(--color-text-muted)]">Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product) => (
                                            <tr key={product.id} className="hover:bg-background-subtle transition-colors">
                                                <td className="px-4 py-4 text-body-sm">{product.nameHi}</td>
                                                <td className="px-4 py-4 text-body-sm">{product.available}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                            <h2 className="text-h5 font-semibold mb-4">Profile</h2>
                            <div className="space-y-3">
                                <div className="text-body-sm">Store: {profile.storeName}</div>
                                <div className="text-body-sm">City: {profile.city}</div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-kridha-secondary text-kridha-primary">
                                    {profile.profileStatus === 'VERIFIED' ? 'Verified' : 'Pending'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-6">
                            <h2 className="text-h5 font-semibold mb-4">Quick actions</h2>
                            <Button variant="primary" size="sm" className="w-full">
                                Add product
                            </Button>
                            <Button variant="outline" size="sm" className="w-full">
                                Review payouts
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </AuthGuard>
    );
}