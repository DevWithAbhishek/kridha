'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Filter, Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFetch } from '@/hooks/useFetch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';

type Product = {
    id: string;
    nameHi: string;
    nameEn: string;
    seller: { storeName: string };
    imageUrl?: string;
    minPrice: number;
    distance: number;
    unitIncrement: number;
    unit: string;
    dealActive?: boolean;
    dealExpiresAt?: string;
};

const DUMMY_PRODUCTS: Product[] = [
    {
        id: '1',
        nameHi: 'गेहूं का आटा',
        nameEn: 'Wheat Flour',
        seller: { storeName: 'Ramesh Kirana' },
        imageUrl: '/images/placeholder.svg',
        minPrice: 45,
        distance: 2.2,
        unitIncrement: 1,
        unit: 'kg',
        dealActive: true,
        dealExpiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    {
        id: '2',
        nameHi: 'सरसों का तेल',
        nameEn: 'Mustard Oil',
        seller: { storeName: 'Suresh Mill' },
        imageUrl: '/images/placeholder.svg',
        minPrice: 180,
        distance: 1.8,
        unitIncrement: 1,
        unit: 'ltr',
    },
    {
        id: '3',
        nameHi: 'चना',
        nameEn: 'Chickpeas',
        seller: { storeName: 'Mohan Store' },
        imageUrl: '/images/placeholder.svg',
        minPrice: 72,
        distance: 3.1,
        unitIncrement: 1,
        unit: 'kg',
    },
];

function useGeolocation() {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => undefined,
            { maximumAge: 1000 * 60 * 5, timeout: 10000 }
        );
    }, []);

    return { coords };
}

function buildQuery(params: Record<string, string | undefined>) {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            filtered[key] = value;
        }
    }   
    return new URLSearchParams(filtered).toString();
}


function ProductCard({ product }: { product: Product }) {
    const [qty, setQty] = useState(1);

    return (
        <div className="min-w-[280px] bg-[var(--color-surface)] dark:bg-surface-dark rounded-card shadow-card border border-[var(--color-border)] p-5 snap-start">
            <div className="relative mb-4">
                {product.dealActive && (
                    <span className="absolute top-2 right-2 bg-kridha-accent text-gray-900 text-label-sm font-bold px-2 py-1 rounded-pill">
                        DEAL
                    </span>
                )}
                <div className="aspect-product rounded-lg bg-kridha-secondary dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    <Image
                        src={product.imageUrl ?? '/images/placeholder.svg'}
                        alt={product.nameHi}
                        width={320}
                        height={240}
                        className="object-cover"
                    />
                </div>
            </div>

            <div className="mb-2">
                <div className="text-h6 font-semibold">{product.nameHi}</div>
                <div className="text-label-sm text-[var(--color-text-muted)]">{product.seller.storeName}</div>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-h5 font-bold text-kridha-primary">₹{product.minPrice}</div>
                    <div className="text-label-sm text-muted line-through">₹{Math.ceil(product.minPrice * 1.1)}</div>
                </div>
                <span className="bg-kridha-secondary text-kridha-primary text-label-sm rounded-pill px-2">
                    {product.distance} km
                </span>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setQty((prev) => Math.max(1, prev - product.unitIncrement))}
                    className="w-9 h-9 rounded-btn border border-[var(--color-border)]"
                >
                    -
                </button>
                <span className="text-body-sm">{qty}</span>
                <button
                    type="button"
                    onClick={() => setQty((prev) => prev + product.unitIncrement)}
                    className="w-9 h-9 rounded-btn border border-[var(--color-border)]"
                >
                    +
                </button>
            </div>

            <Button variant="primary" size="sm" className="w-full">
                Add to cart
            </Button>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-card border border-dashed border-kridha-primary/30 bg-kridha-secondary/30 p-10 text-center">
            <div className="text-kridha-primary text-3xl mb-4">🛒</div>
            <p className="text-h6 font-semibold mb-2">कोई उत्पाद नहीं मिला</p>
            <p className="text-body-sm text-[var(--color-text-muted)]">अपने खोज शब्द या फ़िल्टर बदलें</p>
        </div>
    );
}

export default function ProductsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const [radius, setRadius] = useState(searchParams.get('radius') ?? '10');
    const [category, setCategory] = useState(searchParams.get('category') ?? '');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') ?? 'distance');
    const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
    const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
    const [dealOnly, setDealOnly] = useState(searchParams.get('dealActive') === 'true');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    const { coords } = useGeolocation();

    useEffect(() => {
        const timer = setTimeout(() => {
            const params = {
                q: search,
                radius,
                category,
                sortBy,
                minPrice,
                maxPrice,
                dealActive: dealOnly ? 'true' : '',
                lat: coords ? String(coords.lat) : undefined,
                lng: coords ? String(coords.lng) : undefined,
            };
            const queryString = buildQuery(params);
            router.replace(`/products?${queryString}`, { scroll: false });
        }, 300);

        return () => clearTimeout(timer);
    }, [search, radius, category, sortBy, minPrice, maxPrice, dealOnly, coords, router]);

    const queryString = useMemo(() => {
        const params = {
            q: search,
            radius,
            category,
            sortBy,
            minPrice,
            maxPrice,
            dealActive: dealOnly ? 'true' : '',
            lat: coords ? String(coords.lat) : undefined,
            lng: coords ? String(coords.lng) : undefined,
        };
        return buildQuery(params);
    }, [search, radius, category, sortBy, minPrice, maxPrice, dealOnly, coords]);

    const { data: products = DUMMY_PRODUCTS, loading } = useFetch<Product[]>(
        `/api/products?${queryString}`,
        DUMMY_PRODUCTS
    );

    const parentRef = useRef<HTMLDivElement | null>(null);
    const rowVirtualizer = useVirtualizer({
        count: products.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 260,
        overscan: 3,
    });

    const filterPills = [
        { value: '5', label: '5 km' },
        { value: '10', label: '10 km' },
        { value: '20', label: '20 km' },
        { value: '50', label: '50 km' },
    ];

    const categories = [
        { value: 'GRAINS', label: 'अनाज' },
        { value: 'OIL', label: 'तेल' },
        { value: 'SPICES', label: 'मसाले' },
        { value: 'FLOUR', label: 'आटा' },
        { value: 'DAIRY', label: 'डेयरी' },
        { value: 'OTHER', label: 'अन्य' },
    ];

    return (
        <div className="bg-[var(--color-bg)] min-h-screen">
            <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <Input
                            className="pl-11"
                            placeholder="Search products"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileFiltersOpen((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-pill border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-label-sm"
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                    </button>
                </div>

                <div className="hidden lg:grid lg:grid-cols-[280px_1fr] gap-6">
                    <aside className="space-y-6">
                        <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5 space-y-5">
                            <div>
                                <h2 className="text-h6 font-semibold mb-3">Radius</h2>
                                <div className="flex flex-wrap gap-2">
                                    {filterPills.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setRadius(item.value)}
                                            className={`rounded-pill px-3 py-2 text-label-sm transition ${radius === item.value
                                                ? 'bg-kridha-primary text-white'
                                                : 'bg-background-subtle text-[var(--color-text-muted)]'
                                                }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-h6 font-semibold mb-3">Category</h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {categories.map((categoryItem) => (
                                        <button
                                            key={categoryItem.value}
                                            type="button"
                                            onClick={() => setCategory(categoryItem.value)}
                                            className={`rounded-pill px-3 py-2 text-label-sm transition ${category === categoryItem.value
                                                ? 'bg-kridha-primary text-white'
                                                : 'bg-background-subtle text-[var(--color-text-muted)]'
                                                }`}
                                        >
                                            {categoryItem.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-h6 font-semibold mb-3">Price</h2>
                                <div className="grid gap-3">
                                    <Input
                                        label="Min"
                                        type="number"
                                        value={minPrice}
                                        onChange={(event) => setMinPrice(event.target.value)}
                                    />
                                    <Input
                                        label="Max"
                                        type="number"
                                        value={maxPrice}
                                        onChange={(event) => setMaxPrice(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-label-sm text-[var(--color-text-muted)]">Deal only</span>
                                <button
                                    type="button"
                                    onClick={() => setDealOnly((prev) => !prev)}
                                    className={`h-8 w-14 rounded-full transition ${dealOnly ? 'bg-kridha-primary' : 'bg-background-subtle'}`}
                                >
                                    <span
                                        className={`block h-7 w-7 rounded-full bg-white transition-transform ${dealOnly ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </aside>

                    <section>
                        {loading ? (
                            <div className="grid gap-6">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        ) : products.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {products.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="lg:hidden">
                    {mobileFiltersOpen && (
                        <div className="fixed inset-x-0 bottom-0 z-50 bg-[var(--color-surface)] rounded-t-3xl border border-[var(--color-border)] p-5 animate-slide-in-up shadow-2xl">
                            <div className="grid gap-5">
                                <div>
                                    <h2 className="text-h6 font-semibold mb-3">Radius</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {filterPills.map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() => setRadius(item.value)}
                                                className={`rounded-pill px-3 py-2 text-label-sm transition ${radius === item.value
                                                    ? 'bg-kridha-primary text-white'
                                                    : 'bg-background-subtle text-[var(--color-text-muted)]'
                                                    }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-h6 font-semibold mb-3">Category</h2>
                                    <div className="grid grid-cols-2 gap-2">
                                        {categories.map((categoryItem) => (
                                            <button
                                                key={categoryItem.value}
                                                type="button"
                                                onClick={() => setCategory(categoryItem.value)}
                                                className={`rounded-pill px-3 py-2 text-label-sm transition ${category === categoryItem.value
                                                    ? 'bg-kridha-primary text-white'
                                                    : 'bg-background-subtle text-[var(--color-text-muted)]'
                                                    }`}
                                            >
                                                {categoryItem.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-h6 font-semibold mb-3">Price</h2>
                                    <div className="grid gap-3">
                                        <Input
                                            label="Min"
                                            type="number"
                                            value={minPrice}
                                            onChange={(event) => setMinPrice(event.target.value)}
                                        />
                                        <Input
                                            label="Max"
                                            type="number"
                                            value={maxPrice}
                                            onChange={(event) => setMaxPrice(event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-label-sm text-[var(--color-text-muted)]">Deal only</span>
                                    <button
                                        type="button"
                                        onClick={() => setDealOnly((prev) => !prev)}
                                        className={`h-8 w-14 rounded-full transition ${dealOnly ? 'bg-kridha-primary' : 'bg-background-subtle'}`}
                                    >
                                        <span
                                            className={`block h-7 w-7 rounded-full bg-white transition-transform ${dealOnly ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                </div>

                                <Button type="button" variant="primary" size="sm" className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                                    Apply filters
                                </Button>
                            </div>
                        </div>
                    )}

                    <div ref={parentRef} className="space-y-4 pb-32">
                        {loading ? (
                            <div className="space-y-4">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        ) : products.length === 0 ? (
                            <EmptyState />
                        ) : (
                            products.map((product) => <ProductCard key={product.id} product={product} />)
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}