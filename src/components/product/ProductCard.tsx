'use client';

import { useState } from 'react';
import Image from 'next/image';
import { calcUnitPrice, applyDeal } from '@/lib/pricing';
import { PriceTierDisplay } from './PriceTierDisplay';
import { QuantitySelector } from './QuantitySelector';
import { DealCountdown } from './DealCountdown';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/types/dashboard';

interface ProductCardProps {
    product: Product;
    onAddToCart: (productId: string, qty: number, windowId: string, date: string) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
    const [quantity, setQuantity] = useState(product.minOrderQuantity);
    const [pickupWindowId, setPickupWindowId] = useState('');
    const [pickupDate, setPickupDate] = useState('');

    const unitPrice = calcUnitPrice(quantity, product.priceTiers);
    const dealPrice = applyDeal(unitPrice, product.deals[0]?.discountPercent ?? null);
    const total = dealPrice * quantity;

    const handleAddToCart = () => {
        if (!pickupWindowId || !pickupDate) {
            alert('Please select pickup window and date');
            return;
        }
        onAddToCart(product.id, quantity, pickupWindowId, pickupDate);
    };

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-card shadow-card border border-border hover:shadow-card-hover transition-all overflow-hidden">
            <div className="aspect-product relative overflow-hidden bg-kridha-secondary dark:bg-gray-800">
                <Image
                    src={product.imageUrls[0] ?? '/images/placeholder.svg'}
                    alt={product.nameHi ?? product.nameEn}
                    fill
                    className="object-cover"
                    blurDataURL={product.blurHash ?? undefined}
                    placeholder={product.blurHash ? 'blur' : 'empty'}
                />
                {product.deals.length > 0 && (
                    <div className="absolute top-2 right-2 bg-kridha-accent text-gray-900 text-label-sm font-bold px-2 py-0.5 rounded-bl-card rounded-tr-card">
                        DEAL
                    </div>
                )}
                {product.distance_km && (
                    <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-gray-900/90 text-kridha-primary text-label-sm px-2 py-0.5 rounded-pill backdrop-blur-sm">
                        {product.distance_km} km
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col gap-3">
                <div>
                    <h3 className="text-h6 font-semibold text-text">{product.nameHi ?? product.nameEn}</h3>
                    <p className="text-label-sm text-muted">{product.seller?.storeName}</p>
                </div>

                {product.deals.length > 0 && <DealCountdown expiresAt={product.deals[0].expiresAt} />}

                <div>
                    <div className="text-h5 font-bold text-kridha-primary">
                        {product.deals.length > 0 ? (
                            <div>
                                <span className="line-through text-muted">₹{unitPrice}</span>
                                <span> ₹{dealPrice}</span>
                            </div>
                        ) : (
                            `₹${unitPrice}`
                        )}
                    </div>
                </div>

                <QuantitySelector
                    value={quantity}
                    onChange={setQuantity}
                    min={product.minOrderQuantity}
                    max={product.maxOrderQuantity ?? undefined}
                    step={product.unitIncrement}
                    unit={product.unit}
                />

                <div className="text-h6 font-bold text-kridha-primary">
                    ₹{total} कुल
                </div>

                <Button variant="primary" size="md" className="w-full" onClick={handleAddToCart}>
                    Add to cart
                </Button>
            </div>
        </div>
    );
}