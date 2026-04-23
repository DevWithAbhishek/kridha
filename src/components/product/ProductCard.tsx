"use client";

import Image from "next/image";
import Link from "next/link";
import {
    MapPin,
    Tag,
} from "lucide-react";
import { useLangStore } from "@/stores/langStore";

// ── Types ─────────────────────────────────────────────────────────────────
interface PriceTier {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}
interface Product {
  id: string;
  nameEn: string;
  nameHi: string | null;
  description: string | null;
  category: string;
  isBranded: boolean;
  unit: string;
  unitIncrement: number;
  minOrderQuantity: number;
  available: number;
  imageUrls: string[];
  blurHash: string | null;
  city: string;
  distance_km: number;
  min_price: number | null;
  dealDiscountPercent: number | null;
  dealExpiresAt: string | null;
  priceTiers: PriceTier[];
  seller?: {
    id: string;
    storeName: string;
    reliabilityScore: number;
    sellerRating: number;
  };
}
interface Page {
  products: Product[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { v: "GRAINS", en: "Grains", hi: "अनाज" },
  { v: "DAIRY", en: "Dairy", hi: "डेयरी" },
  { v: "OIL", en: "Oil", hi: "तेल" },
  { v: "SPICES", en: "Spices", hi: "मसाले" },
  { v: "VEGETABLES", en: "Vegetables", hi: "सब्जियां" },
  { v: "FRUITS", en: "Fruits", hi: "फल" },
  { v: "PULSES", en: "Pulses", hi: "दालें" },
  { v: "FLOUR", en: "Flour", hi: "आटा" },
  { v: "BEVERAGES", en: "Beverages", hi: "पेय" },
  { v: "OTHER", en: "Other", hi: "अन्य" },
];
const SORT_OPTIONS = [
  { v: "distance", en: "Nearest first", hi: "नज़दीक पहले" },
  { v: "price_asc", en: "Price: Low → High", hi: "कम कीमत पहले" },
  { v: "price_desc", en: "Price: High → Low", hi: "ज्यादा कीमत पहले" },
];
const CAT_EMOJI: Record<string, string> = {
  GRAINS: "🌾",
  DAIRY: "🥛",
  OIL: "🫙",
  SPICES: "🌶️",
  VEGETABLES: "🥬",
  FRUITS: "🍎",
  PULSES: "🫘",
  FLOUR: "🌾",
  BEVERAGES: "🍵",
  OTHER: "📦",
};

// ── Price tier helper ─────────────────────────────────────────────────────
function getMinPrice(tiers: PriceTier[]): number {
  if (!tiers.length) return 0;
  return Math.min(...tiers.map((t) => t.pricePerUnit));
}

// ── Product card ──────────────────────────────────────────────────────────
export function ProductCard({ product }: { product: Product }) {
  const { lang } = useLangStore();
  const minPrice = product.min_price ?? getMinPrice(product.priceTiers);
  const hasDiscount = !!product.dealDiscountPercent;
  const discountedPrice = hasDiscount
    ? Math.round(minPrice * (1 - product.dealDiscountPercent! / 100))
    : null;
  const name =
    lang === "hi" ? (product.nameHi ?? product.nameEn) : product.nameEn;
  const stars = product.seller?.sellerRating ?? 0;

  return (
    <Link href={`/products/${product.id}`} className="group block h-full">
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden hover:shadow-lg hover:border-kridha-primary/40 transition-all duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
          {product.imageUrls?.[0] ? (
            <Image
              src={product.imageUrls[0]}
              alt={name}
              fill
              sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              {CAT_EMOJI[product.category] ?? "📦"}
            </div>
          )}
          {/* Deal badge */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow">
              <Tag className="w-2.5 h-2.5" />
              {product.dealDiscountPercent}% OFF
            </div>
          )}
          {/* Out of stock */}
          {product.available === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 text-label-xs font-bold px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
          {/* Image count */}
          {product.imageUrls?.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              +{product.imageUrls.length - 1}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-3">
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-0.5 capitalize">
            {product.category.toLowerCase()}
            {product.isBranded ? " · Branded" : ""}
          </p>
          <h3 className="font-semibold text-label-md text-[var(--color-text)] line-clamp-2 leading-snug mb-1">
            {name}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-1.5 mt-auto pt-2">
            <span className="text-label-lg font-bold text-kridha-primary">
              ₹{(discountedPrice ?? minPrice).toLocaleString("en-IN")}
            </span>
            {hasDiscount && (
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark line-through">
                ₹{minPrice.toLocaleString("en-IN")}
              </span>
            )}
            <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
              /{product.unit.toLowerCase()}
            </span>
          </div>

          {/* Seller + distance */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark truncate">
              {product.seller?.storeName ?? product.city}
            </p>
            {product.distance_km > 0 && (
              <span className="flex items-center gap-0.5 text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
                <MapPin className="w-2.5 h-2.5" />
                {product.distance_km.toFixed(1)}km
              </span>
            )}
          </div>

          {/* Rating */}
          {stars > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={`text-[11px] ${i <= Math.round(stars) ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                {stars.toFixed(1)}
              </span>
            </div>
          )}

          {/* Stock indicator */}
          {product.available > 0 && product.available <= 10 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
              Only {product.available} left
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}