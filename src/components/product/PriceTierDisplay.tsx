import { calcUnitPrice, applyDeal } from '@/lib/pricing';
import type { PriceTier, Deal } from '@/types/dashboard';

interface PriceTierDisplayProps {
    tiers: PriceTier[];
    currentQty: number;
    unit: string;
    activeDeal?: Deal | null;
}

export function PriceTierDisplay({ tiers, currentQty, unit, activeDeal }: PriceTierDisplayProps) {
    const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);
    const activeTierIndex = sortedTiers.findIndex((tier) => currentQty >= tier.minQty && (tier.maxQty === null || currentQty <= tier.maxQty));

    return (
        <div className="w-full text-body-sm border border-border rounded-card overflow-hidden">
            <div className="bg-kridha-secondary dark:bg-gray-800 text-kridha-primary font-semibold grid grid-cols-3 gap-4 px-4 py-2">
                <div>न्यूनतम qty</div>
                <div>अधिकतम qty</div>
                <div>मूल्य/{unit}</div>
            </div>
            <div className="divide-y divide-border">
                {sortedTiers.map((tier, index) => {
                    const isActive = index === activeTierIndex;
                    const price = applyDeal(tier.pricePerUnit, activeDeal?.discountPercent ?? null);
                    return (
                        <div
                            key={tier.id}
                            className={`grid grid-cols-3 gap-4 px-4 py-3 ${isActive ? 'bg-kridha-primary/10 dark:bg-kridha-primary/20 font-semibold border-l-2 border-kridha-primary' : ''}`}
                        >
                            <div>{tier.minQty}</div>
                            <div>{tier.maxQty ?? '∞'}</div>
                            <div>
                                {activeDeal && price !== tier.pricePerUnit ? (
                                    <div>
                                        <span className="line-through text-muted">₹{tier.pricePerUnit}</span>
                                        <span className="text-kridha-primary font-bold text-h6"> ₹{price}</span>
                                    </div>
                                ) : (
                                    `₹${tier.pricePerUnit}`
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {activeDeal && (
                <div className="bg-kridha-accent/10 text-yellow-800 dark:text-yellow-200 text-label-sm px-3 py-2">
                    Deal: {activeDeal.discountPercent}% off · Expires {new Date(activeDeal.expiresAt).toLocaleDateString()}
                </div>
            )}
        </div>
    );
}