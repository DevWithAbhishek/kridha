'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useLogin } from '@/hooks/useLogin';

export function HeroSection() {
    const t = useTranslations('hero');
    const { loading, isLoggedIn } = useLogin();

    return (
        <section className="relative bg-hero-pattern dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-800 py-16 lg:py-24">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
                <div className="lg:flex lg:items-center lg:gap-12">
                    {/* Left side */}
                    <div className="lg:w-11/20 mb-12 lg:mb-0">

                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-kridha-accent/20 border border-kridha-accent/40 text-yellow-800 px-3 py-1.5 rounded-pill text-label-sm font-semibold mb-6">
                            <span className="w-2 h-2 bg-kridha-accent rounded-full animate-pulse" />
                            {t('badge')}
                        </div>

                        {/* Headline */}
                        <h1 className="text-display-lg lg:text-display-xl font-bold text-[var(--color-text)] leading-tight mb-4">
                            {t('headline').split(' ').map((word, i) => (
                                <span key={i} className={i === 1 ? 'text-kridha-primary' : ''}>
                                    {word}{' '}
                                </span>
                            ))}
                        </h1>

                        {/* Subheadline */}
                        <p className="text-body-lg text-[var(--color-text-muted)] max-w-content mb-8">
                            {t('subheadline')}
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                            {!loading && (
                                isLoggedIn ? (
                                    <>
                                        <Button variant="primary" size="lg" asChild>
                                            <Link href="/products">{t('cta_buyer')}</Link>
                                        </Button>

                                        <Button variant="outline" size="lg" asChild>
                                            <Link href="/profile/dashboard">Go to Dashboard</Link>
                                        </Button>
                                    </>
                                ) : (
                                        <>
                                            <Button variant="primary" size="lg" asChild>
                                                <Link href="/products">{t('cta_buyer')}</Link>
                                            </Button>

                                            <Button variant="outline" size="lg" asChild>
                                                <Link href="/seller-registration">{t('cta_seller')}</Link>
                                            </Button>
                                        </>
                                )
                            )}
                        </div>

                        {/* Trust row */}
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 bg-kridha-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                                    र
                                </div>
                                <div className="w-8 h-8 bg-kridha-accent rounded-full flex items-center justify-center text-gray-900 text-sm font-bold">
                                    स
                                </div>
                                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                    म
                                </div>
                            </div>
                            <span className="text-body-sm text-[var(--color-text-muted)]">
                                50+ suppliers in Lucknow
                            </span>
                        </div>
                    </div>

                    {/* Right side - Order mockup */}
                    <div className="lg:w-9/20 hidden sm:block">
                        <div className="bg-[var(--color-surface)] rounded-card shadow-card p-6 border border-[var(--color-border)]">
                            <div className="flex flex-col items-center gap-3 mb-4">
                                <span className="font-semibold">Order #1234</span>
                                <Image src="/images/kridha_logo_nav.png" alt="Kridha" width={320} height={320} />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Status</span>
                                    <span className="text-kridha-primary font-semibold">Ready for pickup</span>
                                </div>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map((digit) => (
                                        <div key={digit} className="w-10 h-10 border-2 border-kridha-accent rounded flex items-center justify-center font-bold text-kridha-accent">
                                            {digit}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}