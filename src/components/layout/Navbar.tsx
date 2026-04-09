'use client';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/Button';

export function Navbar() {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
        { href: '/', label: t('home') },
        { href: '/products', label: t('products') },
        { href: '#how', label: t('how_it_works') },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <header className="sticky top-0 z-sticky w-full bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
            <div className="max-w-page mx-auto flex items-center justify-between h-16 px-page-x md:px-page-x-md">
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/images/kridha_logo_nav.png"
                            alt="Kridha"
                            width={36}
                            height={36}
                            className="md:hidden"
                        />
                        <Image
                            src="/images/kridha_logo_footer.png"
                            alt="Kridha"
                            height={32}
                            width={120}
                            className="hidden md:block"
                        />
                    </Link>
                    <nav className="hidden md:flex gap-6">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-label-md transition-colors ${isActive(link.href)
                                        ? 'text-kridha-primary font-semibold'
                                        : 'text-[var(--color-text-muted)] hover:text-kridha-primary'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <LanguageToggle />
                    <ThemeToggle />
                    <Button variant="outline" size="sm">
                        {t('login')}
                    </Button>
                    <Button variant="primary" size="sm">
                        {t('get_started')}
                    </Button>
                </div>
                <div className="md:hidden flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageToggle />
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-btn hover:bg-kridha-primary/20 transition"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
            </div>
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--color-surface)] animate-slide-in-up border-b border-[var(--color-border)]">
                    <nav className="flex flex-col gap-4 p-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-label-md transition-colors ${isActive(link.href)
                                        ? 'text-kridha-primary font-semibold'
                                        : 'text-[var(--color-text-muted)] hover:text-kridha-primary'
                                    }`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="flex flex-col gap-3 mt-4">
                            <Button variant="outline" size="sm" className="w-full">
                                {t('login')}
                            </Button>
                            <Button variant="primary" size="sm" className="w-full">
                                {t('get_started')}
                            </Button>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}