'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Box, ShoppingCart, User, Bell } from 'lucide-react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
// import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { LanguageToggle } from '@/components/shared/LanguageToggle';

const buyerNav = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/orders', label: 'Orders', icon: Box },
    { href: '/favorites', label: 'Favorites', icon: ShoppingCart },
    { href: '/saved', label: 'Saved', icon: User },
    { href: '/notifications', label: 'Notifications', icon: Bell },
];

const sellerNav = [
    { href: '/seller/dashboard', label: 'Seller Dashboard', icon: Home },
    { href: '/seller/orders', label: 'My Orders', icon: Box },
    { href: '/seller/products', label: 'My Products', icon: ShoppingCart },
    { href: '/seller/analytics', label: 'Analytics', icon: User },
    { href: '/seller/notifications', label: 'Notifications', icon: Bell },
];

const accountNav = [
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/settings', label: 'Settings', icon: Box },
    { href: '/logout', label: 'Logout', icon: Home },
];

const bottomTabs = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/products', label: 'Products', icon: Box },
    { href: '/cart', label: 'Cart', icon: ShoppingCart },
    { href: '/dashboard', label: 'Account', icon: User },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { isSeller } = useAuth();

    const renderNav = (items: typeof buyerNav) =>
        items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm transition ${active
                        ? 'bg-kridha-secondary text-kridha-primary font-semibold'
                        : 'text-[var(--color-text-muted)] hover:bg-background-subtle'
                        }`}
                >
                    <Icon className="w-4 h-4" />
                    {item.label}
                </Link>
            );
        });

    return (
        <AuthGuard>
            <div className="min-h-screen bg-[var(--color-bg)]">
                <aside className="hidden lg:block bg-[var(--color-surface)] dark:bg-surface-dark border-r border-[var(--color-border)] h-screen fixed left-0 top-0 pt-16 pb-6 overflow-y-auto z-sticky w-64">
                    <div className="flex items-center px-4 mb-2 justify-between">
                        <div className="flex items-center gap-3">
                            <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={36} height={36} />
                            <span className="text-h5 font-bold text-kridha-primary">Kridha</span>
                        </div>
                        <ThemeToggle />
                    </div>
                    <div className="flex justify-center">
                        <LanguageToggle />
                    </div>
                    {/* <div className="space-y-1 px-2">{renderNav(buyerNav)}</div> */}
                    {isSeller && (
                        <div className="mt-8 px-2 space-y-1">
                            <div className="text-label-sm font-semibold text-[var(--color-text-muted)] px-4 mb-2">
                                Seller
                            </div>
                            {renderNav(sellerNav)}
                        </div>
                    )}
                    <div className="mt-8 px-2 space-y-1">
                        <div className="text-label-sm font-semibold text-[var(--color-text-muted)] px-4 mb-2">
                            Account
                        </div>
                        {renderNav(accountNav)}
                    </div>
                </aside>

                <div className="lg:ml-64">
                    <div className="lg:hidden px-page-x py-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                        <div className="flex items-center gap-3">
                            <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={36} height={36} />
                            <span className="text-h5 font-bold text-kridha-primary">Kridha</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <LanguageToggle />
                            <ThemeToggle />
                            <button type="button" className="p-2 rounded-btn hover:bg-kridha-primary/20 transition">
                                <Bell className="w-5 h-5 text-[var(--color-text-muted)]" />
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 pb-20 lg:pt-8 lg:px-8">{children}</div>
                </div>

                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex justify-around py-2 z-sticky">
                    {bottomTabs.map((tab) => {
                        const active = pathname === tab.href;
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1">
                                <Icon className={`w-5 h-5 ${active ? 'text-kridha-primary' : 'text-[var(--color-text-muted)]'}`} />
                                <span className={`text-label-sm ${active ? 'text-kridha-primary' : 'text-[var(--color-text-muted)]'}`}>
                                    {tab.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </AuthGuard>
    );
}