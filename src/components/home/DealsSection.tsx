'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useFetch } from '@/hooks/useFetch';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

interface Deal {
    id: string;
    nameHi: string;
    nameEn: string;
    imageUrl?: string;
    seller: { storeName: string };
    price: number;
    discountedPrice: number;
    discountPercent: number;
    distance: number;
}

const dummyDeals: Deal[] = [
    {
        id: '1',
        nameHi: 'गेहूं का आटा',
        nameEn: 'Wheat Flour',
        seller: { storeName: 'Ramesh Kirana' },
        price: 50,
        discountedPrice: 45,
        discountPercent: 10,
        distance: 2.3,
    },
    {
        id: '2',
        nameHi: 'सरसों का तेल',
        nameEn: 'Mustard Oil',
        seller: { storeName: 'Suresh Mill' },
        price: 200,
        discountedPrice: 180,
        discountPercent: 10,
        distance: 1.8,
    },
    {
        id: '3',
        nameHi: 'चना',
        nameEn: 'Chickpeas',
        seller: { storeName: 'Mohan Store' },
        price: 80,
        discountedPrice: 72,
        discountPercent: 10,
        distance: 3.1,
    },
];

export function DealsSection() {
    const t = useTranslations('deals');
    const lat = 26.713;
    const lng = 83.330;
    const { data: deals, loading } = useFetch<Deal[]>(`/api/products/deals?lat=${lat}&lng=${lng}`, dummyDeals);

    return (
        <section className="bg-[var(--color-surface)] dark:bg-gray-900 py-section-y">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-h2 font-bold">{t('title')}</h2>
                    <Link href="/products?dealActive=true" className="text-kridha-primary hover:underline">
                        {t('see_all')}
                    </Link>
                </div>

                {loading ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible">
                        {/* {deals?.map((deal) => (
                            <div key={deal.id} className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-card shadow-card border border-[var(--color-border)] p-card min-w-[280px] snap-center lg:min-w-0">
                                <div className="relative mb-4">
                                    <div className="absolute top-0 right-0 bg-kridha-accent text-gray-900 text-label-sm font-bold px-2 py-0.5 rounded-bl-md">
                                        {deal.discountPercent}% OFF
                                    </div>
                                    <div className="aspect-product rounded-lg bg-kridha-secondary dark:bg-gray-700 flex items-center justify-center">
                                        {deal.imageUrl ? (
                                            <Image src={deal.imageUrl} alt={deal.nameHi} width={200} height={200} className="object-cover rounded-lg" />
                                        ) : (
                                            <Image src="/images/placeholder.svg" alt="Placeholder" width={100} height={100} />
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-h6 font-semibold mb-1">{deal.nameHi}</h3>
                                <p className="text-label-sm text-[var(--color-text-muted)] mb-2">{deal.seller.storeName}</p>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-kridha-primary font-bold">₹{deal.discountedPrice}</span>
                                    <span className="text-muted text-sm line-through">₹{deal.price}</span>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="bg-kridha-secondary text-kridha-primary text-label-sm rounded-pill px-2">
                                        {deal.distance} km
                                    </span>
                                    <span className="text-label-sm text-muted">Ends in 2h</span>
                                </div>
                                <Button variant="primary" size="sm" className="w-full">
                                    Add to cart
                                </Button>
                            </div>
                        ))} */}
                    </div>
                )}
            </div>
        </section>
    );
}