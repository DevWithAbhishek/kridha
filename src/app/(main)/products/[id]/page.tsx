'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useFetch } from '@/hooks/useFetch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { DUMMY_PRODUCTS } from '@/data/dummy';

type PriceTier = {
    minQty: number;
    maxQty: number;
    pricePerUnit: number;
};

type ProductDetail = {
    id: string;
    nameHi: string;
    nameEn: string;
    description: string;
    imageUrls: string[];
    seller: { storeName: string; city: string; reliability: number };
    priceTiers: PriceTier[];
    unitIncrement: number;
    minOrderQuantity: number;
    dealActive?: boolean;
    dealExpiresAt?: string;
    pickupWindows: string[];
};

type Review = {
    id: string;
    name: string;
    rating: number;
    comment: string;
    date: string;
};

export default function ProductDetailPage() {
    const params = useParams();
    const productId = params?.id as string;

    const { data: product = DUMMY_PRODUCTS[0] as any, loading: productLoading } = useFetch<ProductDetail>(
        `/api/products/${productId}`,
        DUMMY_PRODUCTS[0] as any
    );

    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(product.minOrderQuantity ?? 1);
    const [selectedWindow, setSelectedWindow] = useState(product.pickupWindows?.[0] ?? '');
    const [pickupDate, setPickupDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
    });

    const unitPrice = useMemo(() => {
        const tier = product.priceTiers?.find(
            (item) => quantity >= item.minQty && quantity <= item.maxQty
        );
        return tier?.pricePerUnit ?? product.priceTiers?.[0]?.pricePerUnit ?? 0;
    }, [product.priceTiers, quantity]);

    const totalPrice = quantity * unitPrice;

    const [reviewPage, setReviewPage] = useState(1);
    const { data: reviews = [], loading: reviewsLoading } = useFetch<Review[]>(
        `/api/reviews?productId=${productId}&page=${reviewPage}`,
        []
    );

    if (productLoading) {
        return (
            <div className="grid gap-6">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <div className="max-w-page mx-auto px-page-x md:px-page-x-md py-10">
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                    <div className="rounded-card overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <Image
                            src={product.imageUrls?.[selectedImage] ?? '/images/product-demo.svg'}
                            alt={product.nameHi}
                            width={800}
                            height={560}
                            className="w-full aspect-product object-cover"
                        />
                    </div>

                    {product.imageUrls?.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto">
                            {product.imageUrls.map((src, index) => (
                                <button
                                    key={src}
                                    type="button"
                                    onClick={() => setSelectedImage(index)}
                                    className={`h-24 w-24 rounded-lg overflow-hidden border ${selectedImage === index ? 'border-kridha-primary' : 'border-[var(--color-border)]'
                                        }`}
                                >
                                    <Image src={src} alt={`Thumbnail ${index + 1}`} width={96} height={96} className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                        {product.dealActive && (
                            <span className="rounded-pill bg-kridha-accent text-gray-900 px-3 py-1 text-label-sm font-semibold">
                                Deal active
                            </span>
                        )}
                        <span className="text-label-sm text-[var(--color-text-muted)]">{product.seller.city}</span>
                    </div>

                    <div>
                        <h1 className="text-display-sm font-bold">{product.nameHi}</h1>
                        <p className="text-body-sm text-[var(--color-text-muted)]">{product.nameEn}</p>
                    </div>

                    <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-label-sm text-[var(--color-text-muted)]">Seller</span>
                            <span className="text-body-sm font-semibold">{product.seller.storeName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-label-sm text-[var(--color-text-muted)]">Reliability</span>
                            <span className="text-body-sm font-semibold">{product.seller.reliability}/5</span>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5">
                        <div className="grid gap-3">
                            <div className="text-label-sm text-[var(--color-text-muted)]">Quantity</div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQuantity((prev) => Math.max(product.minOrderQuantity ?? 1, prev - product.unitIncrement))
                                    }
                                    className="w-11 h-11 rounded-btn border border-[var(--color-border)]"
                                >
                                    -
                                </button>
                                <span className="text-body-md">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((prev) => prev + product.unitIncrement)}
                                    className="w-11 h-11 rounded-btn border border-[var(--color-border)]"
                                >
                                    +
                                </button>
                                <span className="text-label-sm text-[var(--color-text-muted)]">{product.unit}</span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-3">
                            <div className="text-label-sm text-[var(--color-text-muted)]">Pickup window</div>
                            <select
                                className="w-full rounded-lg border border-[var(--color-border)] bg-surface px-4 py-3 text-body-md focus:border-kridha-primary focus:shadow-focus-primary"
                                value={selectedWindow}
                                onChange={(event) => setSelectedWindow(event.target.value)}
                            >
                                {product.pickupWindows?.map((window) => (
                                    <option key={window} value={window}>
                                        {window}
                                    </option>
                                ))}
                            </select>
                            <div>
                                <div className="text-label-sm text-[var(--color-text-muted)]">Pickup date</div>
                                <Input
                                    type="date"
                                    value={pickupDate}
                                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                    onChange={(event) => setPickupDate(event.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="text-label-sm text-[var(--color-text-muted)]">Unit price</div>
                            <div className="text-h4 font-bold text-kridha-primary">₹{unitPrice}</div>
                        </div>
                        <div>
                            <div className="text-label-sm text-[var(--color-text-muted)]">Total</div>
                            <div className="text-h4 font-bold text-kridha-primary">₹{totalPrice}</div>
                        </div>
                    </div>

                    <Button variant="primary" size="lg" className="w-full">
                        Add to cart
                    </Button>

                    {product.dealExpiresAt && (
                        <div className="rounded-pill bg-kridha-secondary px-4 py-3 text-label-sm text-kridha-primary">
                            Deal ends soon
                        </div>
                    )}
                </div>
            </div>

            <section className="mt-12">
                <h2 className="text-h5 font-semibold mb-6">Reviews</h2>
                {reviewsLoading ? (
                    <div className="space-y-4">
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                ) : (
                    <div className="grid gap-5">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-[var(--color-surface)] rounded-card border border-[var(--color-border)] p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <Image
                                        src="/images/profile-default.png"
                                        alt={review.name}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover"
                                    />
                                    <div>
                                        <div className="font-semibold">{review.name}</div>
                                        <div className="text-label-sm text-[var(--color-text-muted)]">{review.date}</div>
                                    </div>
                                </div>
                                <div className="text-body-sm italic text-[var(--color-text)] mb-3">`${review.comment}`</div>
                                <div className="text-label-sm text-kridha-primary">{'★'.repeat(review.rating)}</div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-6 flex justify-center">
                    <Button variant="outline" size="sm">
                        Load more
                    </Button>
                </div>
            </section>
        </div>
    );
}