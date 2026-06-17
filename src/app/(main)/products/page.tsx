"use client";

// Buyer product feed — search, filter by category/price/brand/deal,
// sort by distance/price, infinite scroll with "Load more" fallback,
// low-connectivity safe (staleTime + gcTime), TanStack Virtual ready.

import { useState, useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  X,
  ChevronDown,
  Package2,
  WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { useGeolocation, LUCKNOW_FALLBACK } from "@/hooks/useGeolocation";
import { ProductCard } from "@/components/product/ProductCard";

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

// ── Filter sheet (mobile bottom drawer / desktop panel) ────────────────────
function FilterPanel({
  filters,
  onChange,
  onReset,
  onClose,
}: {
  filters: Record<string, string | boolean | number | undefined>;
  onChange: (k: string, v: string | boolean | number | undefined) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const { lang } = useLangStore();
  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-DEFAULT dark:border-border-dark flex-shrink-0">
        <h3 className="font-bold text-label-lg text-[var(--color-text)]">
          {lang === "hi" ? "Filters" : "Filters"}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="text-label-sm text-kridha-primary hover:underline"
          >
            {lang === "hi" ? "Reset" : "Reset all"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Category */}
        <div>
          <p className="text-label-md font-semibold text-[var(--color-text)] mb-3">
            {lang === "hi" ? "Category" : "Category"}
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const sel = filters.category === c.v;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => onChange("category", sel ? undefined : c.v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-medium transition-all border ${sel ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] border-transparent hover:border-kridha-primary hover:text-kridha-primary"}`}
                >
                  <span>{CAT_EMOJI[c.v]}</span>
                  {lang === "hi" ? c.hi : c.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price range */}
        <div>
          <p className="text-label-md font-semibold text-[var(--color-text)] mb-3">
            {lang === "hi" ? "Price Range (₹)" : "Price Range (₹)"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-1 block">
                Min
              </label>
              <input
                type="number"
                min="0"
                placeholder="₹0"
                value={(filters.minPrice as string) ?? ""}
                onChange={(e) =>
                  onChange("minPrice", e.target.value || undefined)
                }
                className="w-full px-3 py-2.5 border border-border-DEFAULT dark:border-border-dark rounded-xl bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-label-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20"
              />
            </div>
            <div>
              <label className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-1 block">
                Max
              </label>
              <input
                type="number"
                min="0"
                placeholder="₹9999"
                value={(filters.maxPrice as string) ?? ""}
                onChange={(e) =>
                  onChange("maxPrice", e.target.value || undefined)
                }
                className="w-full px-3 py-2.5 border border-border-DEFAULT dark:border-border-dark rounded-xl bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-label-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-label-md font-semibold mb-3">
            {lang === "hi" ? "Distance (km)" : "Distance (km)"}
          </p>

          <input
            type="range"
            min="1"
            max="50"
            value={Number(filters.radius ?? 25)}
            onChange={(e) => onChange("radius", Number(e.target.value))}
            className="w-full"
          />

          <div className="text-sm text-muted mt-1">
            {filters.radius ?? 25} km
          </div>
        </div>

        {/* Toggle filters */}
        {[
          {
            k: "isBranded",
            en: "Branded only",
            hi: "Branded products",
            emoji: "🏷️",
          },
          {
            k: "dealActive",
            en: "Deals only",
            hi: "Deal wale products",
            emoji: "🔥",
          },
        ].map((item) => {
          const isActive = Boolean(filters[item.k]); // ✅ STEP 1

          return (
            <div key={item.k} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.emoji}</span>
                <p className="text-label-md text-[var(--color-text)]">
                  {lang === "hi" ? item.hi : item.en}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => onChange(item.k, !isActive)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-kridha-primary"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                    isActive ? "left-[22px]" : "left-[2px]"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────
function SkeletonProduct() {
  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden animate-pulse">
      <div className="w-full aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/5 mt-2" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ProductsPage() {
  const { lang } = useLangStore();
  const {
    lat,
    lng,
    loading: geoLoading,
    error: geoError,
    retry,
  } = useGeolocation();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDQ] = useState("");
  const [sortBy, setSortBy] = useState("distance");
  const [filters, setFilters] = useState<
    Record<string, string | boolean | number | undefined>
  >({
    radius: 25,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const loadMoreRef = useRef<HTMLButtonElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDQ(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const eLat = lat ?? LUCKNOW_FALLBACK.lat;
  const eLng = lng ?? LUCKNOW_FALLBACK.lng;

  const effectiveLat = eLat.toFixed(3);
  const effectiveLng = eLng.toFixed(3);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<Page>({
    queryKey: [
      "products-feed",
      debouncedQ,
      sortBy,
      JSON.stringify(filters),
      effectiveLat,
      effectiveLng,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const p = new URLSearchParams({
        lat: String(effectiveLat),
        lng: String(effectiveLng),
        sortBy,
        page: String(pageParam),
        limit: "20",
      });
      if (debouncedQ) p.set("q", debouncedQ);
      if (filters.category) p.set("category", filters.category as string);
      if (filters.minPrice !== undefined && filters.minPrice !== "")
        p.set("minPrice", String(Number(filters.minPrice)));
      if (filters.maxPrice !== undefined && filters.maxPrice !== "")
        p.set("maxPrice", String(Number(filters.maxPrice)));
      if (filters.radius) p.set("radius", String(filters.radius));
      if (filters.isBranded === true) p.set("isBranded", "true");
      if (filters.dealActive === true) p.set("dealActive", "true");
      const res = await api.get(`/products?${p}`);
      return res.data.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.hasMore ? last.meta.page + 1 : undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

  const products = data?.pages.flatMap((p) => p.products) ?? [];
  const totalCount = data?.pages[0]?.meta.total ?? 0;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function updateFilter(k: string, v: string | boolean | number | undefined) {
    setFilters((prev) => ({ ...prev, [k]: v }));
  }
  function resetFilters() {
    setFilters({});
  }
  function clearSearch() {
    setQuery("");
    setDQ("");
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT dark:bg-background-dark">
      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[var(--color-surface)] dark:bg-surface-dark border-b border-border-DEFAULT dark:border-border-dark px-4 py-3 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-DEFAULT dark:text-muted-dark" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === "hi"
                ? "products search करें..."
                : "Search products, sellers..."
            }
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-border-DEFAULT dark:border-border-dark bg-gray-50 dark:bg-gray-800/50 text-[var(--color-text)] text-body-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 focus:bg-[var(--color-surface)] dark:focus:bg-surface-dark transition-all"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-DEFAULT hover:text-[var(--color-text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
          {/* Filter trigger */}
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-label-sm font-semibold border transition-all flex-shrink-0 ${activeFilterCount > 0 || filterOpen ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] border-transparent"}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {lang === "hi" ? "Filter" : "Filter"}
            {activeFilterCount > 0 && (
              <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort pills */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.v}
              onClick={() => setSortBy(opt.v)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-label-sm font-medium border transition-all flex-shrink-0 ${sortBy === opt.v ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] border-transparent"}`}
            >
              {opt.v === "distance" && <MapPin className="w-3 h-3" />}
              {lang === "hi" ? opt.hi : opt.en}
            </button>
          ))}

          {/* Quick category pills */}
          {CATEGORIES.slice(0, 4).map((c) => (
            <button
              key={c.v}
              onClick={() =>
                updateFilter(
                  "category",
                  filters.category === c.v ? undefined : c.v,
                )
              }
              className={`px-3 py-2 rounded-xl text-label-sm font-medium border transition-all flex-shrink-0 ${filters.category === c.v ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] border-transparent"}`}
            >
              {CAT_EMOJI[c.v]} {lang === "hi" ? c.hi : c.en}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILTER DRAWER ─────────────────────────────────────── */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setFilterOpen(false)}
          />
          <div className="relative w-full sm:w-80 h-[75vh] sm:h-screen bg-[var(--color-surface)] dark:bg-surface-dark rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col overflow-hidden">
            <FilterPanel
              filters={filters}
              onChange={updateFilter}
              onReset={() => {
                resetFilters();
                setFilterOpen(false);
              }}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Location + result count */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {geoLoading ? (
              <span className="flex items-center gap-1.5 text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Detecting location...
              </span>
            ) : geoError ? (
              <button
                onClick={retry}
                className="flex items-center gap-1.5 text-label-sm text-amber-600 dark:text-amber-400 hover:underline"
              >
                <WifiOff className="w-3.5 h-3.5" />
                Using Lucknow — retry
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-label-sm text-green-600 dark:text-green-400">
                <MapPin className="w-3.5 h-3.5" />
                Location detected
              </span>
            )}
          </div>
          {!isLoading && (
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
              {totalCount.toLocaleString("en-IN")}{" "}
              {lang === "hi" ? "products" : "products"}
              {debouncedQ ? ` for "${debouncedQ}"` : ""}
            </p>
          )}
        </div>

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center py-20 gap-3">
            <WifiOff className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
            <p className="text-label-md font-semibold text-[var(--color-text)]">
              {lang === "hi"
                ? "Network error — retry करें"
                : "Network error — please retry"}
            </p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {isLoading &&
            [...Array(10)].map((_, i) => <SkeletonProduct key={i} />)}
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {isFetchingNextPage &&
            [...Array(4)].map((_, i) => <SkeletonProduct key={`more-${i}`} />)}
        </div>

        {/* Empty */}
        {!isLoading && !isError && products.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-4 text-center">
            <Package2 className="w-12 h-12 text-muted-DEFAULT dark:text-muted-dark" />
            <p className="text-h5 font-bold text-[var(--color-text)]">
              {lang === "hi" ? "कोई product नहीं मिला" : "No products found"}
            </p>
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark max-w-xs">
              {debouncedQ
                ? `"${debouncedQ}" से कोई result नहीं`
                : "Try changing your filters or location"}
            </p>
            {(activeFilterCount > 0 || debouncedQ) && (
              <button
                onClick={() => {
                  resetFilters();
                  clearSearch();
                }}
                className="px-5 py-2.5 rounded-xl bg-kridha-primary text-white text-label-sm font-semibold hover:bg-kridha-primary-hover transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && !isFetchingNextPage && (
          <div className="flex justify-center mt-8">
            <button
              ref={loadMoreRef}
              onClick={() => fetchNextPage()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-kridha-primary text-kridha-primary text-label-md font-semibold hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
            >
              <ChevronDown className="w-4 h-4" />
              {lang === "hi" ? "और देखें" : "Load more"}
            </button>
          </div>
        )}

        {/* All loaded */}
        {!hasNextPage && products.length > 0 && !isLoading && (
          <p className="text-center text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-8 py-4">
            {lang === "hi"
              ? `सभी ${products.length} products दिखाए गए`
              : `All ${products.length} products shown`}
          </p>
        )}
      </div>
    </div>
  );
}
