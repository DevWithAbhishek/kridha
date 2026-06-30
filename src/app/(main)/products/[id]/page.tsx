"use client";
import { useState, useMemo, use, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  ShoppingCart,
  ArrowLeft,
  Star,
  MapPin,
  Shield,
  Clock,
  Package,
  Tag,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Minus,
  Calendar,
  Truck,
  Award,
  Share2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { ProductWithRelations } from "@/repo/product.repo";
import { calcUnitPrice } from "@/lib/pricing";
import { Review, DAYS_MAP } from "@/types/dashboard";

// ── Types ─────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  quantity: number;
  pickupWindowId: string;
  pickupDate: string;
}

// ── Deal countdown ─────────────────────────────────────────────────────────
function DealCountdown({ expiresAt }: { expiresAt: Date }) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const urgent = h < 2;
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-label-sm font-semibold ${urgent ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"}`}
    >
      <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
      <span>
        {urgent ? "🔥 " : "⏰ "}
        {h >= 24
          ? `${Math.floor(h / 24)}d ${h % 24}h left`
          : `${h}h ${m}m left`}{" "}
        — Deal ends soon!
      </span>
    </div>
  );
}

// ── Star rating display ────────────────────────────────────────────────────
function StarRating({
  rating,
  count,
  size = "md",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "text-[12px]", md: "text-[16px]", lg: "text-[20px]" };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex ${sizes[size]}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={
              i <= Math.round(rating)
                ? "text-amber-400"
                : "text-gray-300 dark:text-gray-600"
            }
          >
            ★
          </span>
        ))}
      </div>
      <span
        className={`font-semibold text-[var(--color-text)] ${size === "lg" ? "text-label-lg" : size === "sm" ? "text-label-xs" : "text-label-sm"}`}
      >
        {rating.toFixed(1)}
      </span>
      {count !== undefined && (
        <span
          className={`text-muted-DEFAULT dark:text-muted-dark ${size === "sm" ? "text-label-xs" : "text-label-sm"}`}
        >
          ({count.toLocaleString("en-IN")})
        </span>
      )}
    </div>
  );
}

// ── Quantity stepper ──────────────────────────────────────────────────────
function QtyStep({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        onClick={() => onChange(Math.round(Math.max(min, value - step)))}
        disabled={value <= min}
        className="w-11 h-11 flex items-center justify-center rounded-l-xl border border-border-DEFAULT dark:border-border-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors text-[var(--color-text)]"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="w-16 h-11 flex items-center justify-center border-t border-b border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-label-md font-bold text-[var(--color-text)]">
        {Math.round(value)}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.round(Math.max(min, value + step)))}
        disabled={value >= max}
        className="w-11 h-11 flex items-center justify-center rounded-r-xl border border-border-DEFAULT dark:border-border-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors text-[var(--color-text)]"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Review card ────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: Review }) {
  const { lang } = useLangStore();
  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold text-label-md flex-shrink-0">
            {review.buyer?.name?.charAt(0)?.toUpperCase() ?? "A"}
          </div>
          <div>
            <p className="font-semibold text-label-md text-[var(--color-text)]">
              {review.buyer?.name ?? "Anonymous"}
            </p>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
              {new Date(review.createdAt).toLocaleDateString(
                lang === "hi" ? "hi-IN" : "en-IN",
                { day: "numeric", month: "long", year: "numeric" },
              )}
            </p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="text-label-sm text-[var(--color-text)] leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useLangStore();
  const qc = useQueryClient();

  const [selectedImg, setSelectedImg] = useState(0);
  const [qty, setQty] = useState<number | null>(null); // null = uninitialized
  const [selectedWin, setSelectedWin] = useState<string>("");

  const [pickupDate, setPickupDate] = useState(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 19) {
      return now.toISOString().slice(0, 10);
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });

  const [reviewPage, setReviewPage] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);

  const [cartItemId, setCartItemId] = useState<string | null>(null);
  const [cartError, setCartError] = useState("");

  // ── Fetch product ─────────────────────────────────────────────────────
  const {
    data: product,
    isLoading: pLoad,
    isError,
  } = useQuery<ProductWithRelations>({
    queryKey: ["product-detail", id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // Initialize qty and window once product loads
  const initialQty = Math.round(product?.minOrderQuantity ?? 1);
  const effectiveQty = Math.round(qty ?? initialQty);
  const effectiveWin = selectedWin || product?.pickupWindows?.[0]?.id || "";

  // ── Price calculation ─────────────────────────────────────────────────
  const { unitPrice, discountedUnitPrice, totalPrice, activeTier } =
    useMemo(() => {
      if (!product?.priceTiers?.length)
        return {
          unitPrice: 0,
          discountedUnitPrice: 0,
          totalPrice: 0,
          activeTier: null,
        };
      const up = calcUnitPrice(effectiveQty, product.priceTiers);
      const disc = product.dealDiscountPercent
        ? parseFloat((up * (1 - product.dealDiscountPercent / 100)).toFixed(2))
        : null;
      const eff = disc ?? up;
      return {
        unitPrice: up,
        discountedUnitPrice: disc,
        totalPrice: parseFloat((eff * effectiveQty).toFixed(2)),
        activeTier: product.priceTiers.find((t) => effectiveQty >= t.minQty),
      };
    }, [product, effectiveQty]);

  // ── Add to cart mutation ──────────────────────────────────────────────
  const addToCart = useMutation({
    mutationFn: (item: CartItem) => api.post("/cart", item),
    onSuccess: (res) => {
      setCartItemId(res.data.data.id);
      setCartError("");
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e) => {
      const ex = e as {
        response?: { data?: { message?: string; code?: string } };
      };
      const code = ex.response?.data?.code;
      if (code === "INSUFFICIENT_STOCK") {
        setCartError("Not enough stock available");
      } else if (code === "INVALID_PICKUP_DATE") {
        setCartError(
          "This date is not available for pickup. Check available days below.",
        );
      } else {
        setCartError(ex.response?.data?.message ?? "Failed to add to cart");
      }
    },
  });

  const { data: savedCheck } = useQuery({
    queryKey: ["saved-check", id],
    queryFn: () =>
      api.get(`/saved?productId=${id}`).then((r) => ({
        isSaved: r.data.data?.isSaved ?? false,
        savedId: r.data.data?.savedId ?? null,
      })),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });

  const [isFaved, setIsFaved] = useState(false);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);

  // Sync when query loads (use useEffect)
  useEffect(() => {
    if (savedCheck) {
      setIsFaved(savedCheck.isSaved);
      setSavedProductId(savedCheck.savedId);
    }
  }, [savedCheck]);

  const toggleFav = useMutation({
    mutationFn: () => {
      if (isFaved && savedProductId) {
        return api.delete(`/saved/${savedProductId}`); // uses SavedProduct.id
      }
      return api.post("/saved", { productId: id, type: "FAVOURITE" });
    },
    onSuccess: (res) => {
      if (!isFaved) {
        // Just saved — store the new savedProduct.id for future delete
        setSavedProductId(res.data.data?.id ?? null);
      } else {
        setSavedProductId(null);
      }
      setIsFaved((p) => !p);
      qc.invalidateQueries({ queryKey: ["saved-check", id] });
    },
    onError: () => {},
  });

  function handleAddToCart() {
    if (!product) return;
    setCartError("");
    addToCart.mutate({
      productId: id,
      quantity: effectiveQty,
      pickupWindowId: effectiveWin,
      pickupDate,
    });
  }

  // ── Fetch reviews ─────────────────────────────────────────────────────
  const { data: reviewData, isLoading: rLoad } = useQuery<{
    reviews: Review[];
    totalCount: number;
    averageRating: number;
  }>({
    queryKey: ["product-reviews", id, reviewPage],
    queryFn: () =>
      api
        .get(`/reviews?productId=${id}&page=${reviewPage}&limit=5`)
        .then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  const reviews = reviewData?.reviews ?? [];
  const avgRating = reviewData?.averageRating ?? 0;
  const reviewCount = reviewData?.totalCount ?? 0;

  // ── Skeleton ──────────────────────────────────────────────────────────
  if (pLoad)
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );

  if (isError || !product)
    return (
      <div className="flex flex-col items-center py-32 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-DEFAULT dark:text-muted-dark" />
        <p className="text-label-lg font-semibold text-[var(--color-text)]">
          Product not found
        </p>
        <Link
          href="/products"
          className="px-5 py-2.5 rounded-xl bg-kridha-primary text-white text-label-sm font-semibold"
        >
          ← Back to Products
        </Link>
      </div>
    );

  const name =
    lang === "hi" ? (product.nameHi ?? product.nameEn) : product.nameEn;
  const hasDiscount = !!product.dealDiscountPercent;
  const isOutOfStock = product.available === 0;
  const maxQty = product.maxOrderQuantity ?? product.available;

  function handleQtyChange(newQty: number) {
    setQty(Math.round(newQty));
    setCartItemId(null); // must re-add if qty changes
    setCartError("");
  }

  function handleWindowChange(windowId: string) {
    setSelectedWin(windowId);
    setCartItemId(null); // must re-add if window changes
    setCartError("");
  }

  function isWindowExpiredToday(
    window: { endTime: string },
    selectedDate: string,
  ): boolean {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (selectedDate !== todayStr) return false;

    const now = new Date();
    const [endH, endM] = window.endTime.split(":").map(Number);
    const windowEnd = new Date();
    windowEnd.setHours(endH, endM, 0, 0);
    return now >= windowEnd;
  }

  return (
    <div className="bg-background-DEFAULT dark:bg-background-dark min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Back */}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-label-sm text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {lang === "hi" ? "Products पर जाएं" : "Back to Products"}
        </Link>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ── LEFT: Images ───────────────────────────────── */}
          <div className="space-y-3">
            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-[4/3]">
              {product.imageUrls?.[selectedImg] ? (
                <Image
                  src={product.imageUrls[selectedImg]}
                  alt={name}
                  fill
                  sizes="(max-width:1024px) 100vw,50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-6xl">
                  📦
                </div>
              )}
              {/* Deal overlay */}
              {hasDiscount && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-xl text-label-sm font-bold shadow-lg">
                  <Tag className="w-3.5 h-3.5" />
                  {product.dealDiscountPercent}% OFF
                </div>
              )}
              {/* Out of stock overlay */}
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                  <span className="bg-white text-gray-900 font-bold px-5 py-2 rounded-xl text-label-lg">
                    Out of Stock
                  </span>
                </div>
              )}
              {/* Branded badge */}
              {product.isBranded && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded-lg text-label-xs font-bold">
                  <Award className="w-3 h-3" />
                  Branded
                </div>
              )}
              {/* Share */}
              <button
                onClick={() =>
                  navigator.share?.({ title: name, url: window.location.href })
                }
                className="absolute bottom-3 right-3 p-2 rounded-xl bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900 transition-colors"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnails */}
            {product.imageUrls?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.imageUrls.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSelectedImg(i)}
                    className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${i === selectedImg ? "border-kridha-primary shadow-md" : "border-transparent opacity-70 hover:opacity-100 hover:border-border-DEFAULT dark:hover:border-border-dark"}`}
                  >
                    <Image
                      src={src}
                      alt={`Image ${i + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Product info + actions ──────────────── */}
          <div className="space-y-5">
            {/* Category + city */}
            <div className="flex items-center gap-2 text-label-sm flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary font-medium capitalize">
                {product.category.toLowerCase()}
              </span>
              <span className="flex items-center gap-1 text-muted-DEFAULT dark:text-muted-dark">
                <MapPin className="w-3.5 h-3.5" />
                {product.city}
              </span>
              {product.distance_km > 0 && (
                <span className="text-muted-DEFAULT dark:text-muted-dark">
                  {product.distance_km.toFixed(1)} km away
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <h1 className="text-h3 font-bold text-[var(--color-text)] leading-tight">
                {name}
              </h1>
              {product.nameHi && lang === "en" && (
                <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-1">
                  {product.nameHi}
                </p>
              )}
            </div>

            {/* Rating summary */}
            {avgRating > 0 && (
              <StarRating rating={avgRating} count={reviewCount} size="md" />
            )}

            {/* Deal countdown */}
            {product.dealExpiresAt && (
              <DealCountdown expiresAt={product.dealExpiresAt} />
            )}

            {/* Price block */}
            <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-h2 font-bold text-kridha-primary">
                  ₹{(discountedUnitPrice ?? unitPrice).toLocaleString("en-IN")}
                </span>
                {hasDiscount && (
                  <span className="text-label-lg text-muted-DEFAULT dark:text-muted-dark line-through">
                    ₹{unitPrice.toLocaleString("en-IN")}
                  </span>
                )}
                <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  /{product.unit.toLowerCase()}
                </span>
              </div>
              {effectiveQty > 1 && (
                <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  Total:{" "}
                  <span className="font-bold text-[var(--color-text)]">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </span>
                </p>
              )}

              {/* Price tiers */}
              {product.priceTiers.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-2">
                    {lang === "hi" ? "Bulk pricing:" : "Bulk pricing:"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.priceTiers.map((t, i) => (
                      <span
                        key={i}
                        className={`px-2.5 py-1 rounded-lg text-label-xs font-medium transition-colors ${effectiveQty >= t.minQty ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark"}`}
                      >
                        {t.minQty}+ {product.unit.toLowerCase()} = ₹
                        {t.pricePerUnit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stock indicator */}
            <div className="flex items-center gap-2">
              {isOutOfStock ? (
                <span className="flex items-center gap-1.5 text-label-sm text-error font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  Out of Stock
                </span>
              ) : product.available <= 10 ? (
                <span className="flex items-center gap-1.5 text-label-sm text-amber-600 dark:text-amber-400 font-semibold">
                  <Package className="w-4 h-4" />
                  Only {product.available} {product.unit.toLowerCase()} left
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-label-sm text-green-600 dark:text-green-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  In Stock ({product.available} {product.unit.toLowerCase()})
                </span>
              )}
            </div>

            {/* Quantity */}
            <div>
              <p className="text-label-md font-semibold text-[var(--color-text)] mb-2">
                {lang === "hi" ? "Quantity" : "Quantity"}
              </p>
              <div className="flex items-center gap-4">
                <QtyStep
                  value={effectiveQty}
                  min={product.minOrderQuantity}
                  max={maxQty}
                  step={product.unitIncrement}
                  onChange={handleQtyChange}
                />
                <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                  Min: {product.minOrderQuantity} {product.unit.toLowerCase()}
                </p>
              </div>
            </div>

            {/* Pickup window */}
            {(product.pickupWindows?.length ?? 0) > 0 && (
              <div>
                <p className="text-label-md font-semibold text-[var(--color-text)] mb-2">
                  {lang === "hi" ? "Pickup Window" : "Pickup Window"}
                </p>
                <div className="grid gap-2">
                  {/* {product.pickupWindows!.map((w) => (
                    <label
                      key={w.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${effectiveWin === w.id ? "border-kridha-primary bg-kridha-secondary dark:bg-kridha-primary/10" : "border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary/50"}`}
                    >
                      <input
                        type="radio"
                        name="window"
                        value={w.id}
                        checked={effectiveWin === w.id}
                        onChange={(e) => handleWindowChange(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-label-sm text-[var(--color-text)]">
                          {lang === "hi" ? w.labelHi : w.labelEn}
                        </p>
                        <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                          {w.startTime} – {w.endTime}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {w.daysActive.map((d) => (
                            <span
                              key={d}
                              className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-medium text-muted-DEFAULT dark:text-muted-dark"
                            >
                              {DAYS_MAP[d]?.[lang === "hi" ? "hi" : "en"] ?? d}
                            </span>
                          ))}
                        </div>
                      </div>
                      {effectiveWin === w.id && (
                        <CheckCircle2 className="w-4 h-4 text-kridha-primary flex-shrink-0" />
                      )}
                    </label>
                  ))} */}
                  {product.pickupWindows!.map((w) => {
                    const expired = isWindowExpiredToday(w, pickupDate);
                    return (
                      <label
                        key={w.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all
        ${
          expired
            ? "opacity-40 cursor-not-allowed border-border-DEFAULT dark:border-border-dark"
            : "cursor-pointer"
        }
        ${
          !expired && effectiveWin === w.id
            ? "border-kridha-primary bg-kridha-secondary dark:bg-kridha-primary/10"
            : !expired
              ? "border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary/50"
              : ""
        }`}
                      >
                        <input
                          type="radio"
                          name="window"
                          value={w.id}
                          checked={effectiveWin === w.id}
                          disabled={expired}
                          onChange={(e) =>
                            !expired && handleWindowChange(e.target.value)
                          }
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-label-sm text-[var(--color-text)]">
                            {lang === "hi" ? w.labelHi : w.labelEn}
                            {expired && (
                              <span className="ml-2 text-label-xs text-muted-DEFAULT dark:text-muted-dark font-normal">
                                (Passed)
                              </span>
                            )}
                          </p>
                          <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                            {w.startTime} – {w.endTime}
                          </p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {w.daysActive.map((d) => (
                              <span
                                key={d}
                                className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-medium text-muted-DEFAULT dark:text-muted-dark"
                              >
                                {DAYS_MAP[d]?.[lang === "hi" ? "hi" : "en"] ??
                                  d}
                              </span>
                            ))}
                          </div>
                        </div>
                        {!expired && effectiveWin === w.id && (
                          <CheckCircle2 className="w-4 h-4 text-kridha-primary flex-shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pickup date */}
            <div>
              <p className="text-label-md font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-kridha-primary" />
                {lang === "hi" ? "Pickup Date" : "Pickup Date"}
              </p>
              {effectiveWin &&
                product.pickupWindows &&
                (() => {
                  const win = product.pickupWindows.find(
                    (w) => w.id === effectiveWin,
                  );
                  if (!win) return null;
                  const dayNames = [
                    "",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thurs",
                    "Fri",
                    "Sat",
                    "Sun",
                  ];
                  const activeDayNames = win.daysActive
                    .map((d) => dayNames[d])
                    .join(",");
                  return (
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-2">
                      Available: {activeDayNames}
                    </p>
                  );
                })()}
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setPickupDate(newDate);
                  setCartItemId(null);
                  setCartError("");

                  // Clear selected window if it's now expired for the new date
                  if (selectedWin && product?.pickupWindows) {
                    const win = product.pickupWindows.find(
                      (w) => w.id === selectedWin,
                    );
                    if (win && isWindowExpiredToday(win, newDate)) {
                      setSelectedWin("");
                    }
                  }
                }}
                min={new Date().toISOString().slice(0, 10)}
                max={(() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 30);
                  return d.toISOString().slice(0, 10);
                })()}
                className="w-full px-3 py-2.5 rounded-xl border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-label-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-kridha-primary/30"
              />
              {pickupDate === new Date().toISOString().slice(0, 10) &&
                new Date().getHours() >= 19 && (
                  <p className="text-label-xs text-amber-600 dark:text-amber-400">
                    ⚠️ It's late — confirm the seller still accepts same-day
                    pickup.
                  </p>
                )}
            </div>

            {/* ── Add to cart / in cart state ────────────────────────────────────── */}
            <div className="space-y-3">
              {cartError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-label-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {cartError}
                </div>
              )}

              {cartItemId ? (
                // Fix 4: persistent "in cart" state — does not disappear
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-label-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Added to cart!
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      className="flex-1"
                      onClick={async () => {
                        if (cartItemId) {
                          try {
                            await api.delete(`/cart/${cartItemId}`);
                          } catch {
                            /* ignore — item may already be gone */
                          }
                        }
                        setCartItemId(null);
                        setCartError("");
                      }}
                    >
                      Change Selection
                    </Button>
                    <Link href="/cart" className="flex-1">
                      <Button variant="primary" size="md" className="w-full">
                        <ShoppingCart className="w-4 h-4" />
                        View Cart
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* Favourite */}
                  <button
                    type="button"
                    onClick={() => toggleFav.mutate()}
                    disabled={toggleFav.isPending}
                    className={`p-3 rounded-xl border transition-all flex-shrink-0 ${
                      isFaved
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-500"
                        : "border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT dark:text-muted-dark hover:border-red-300 dark:hover:border-red-700 hover:text-red-500"
                    }`}
                    aria-label={isFaved ? "Remove from saved" : "Save product"}
                  >
                    <Heart
                      className={`w-5 h-5 ${isFaved ? "fill-current" : ""}`}
                    />
                  </button>

                  {/* Add to cart */}
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1"
                    onClick={handleAddToCart}
                    disabled={
                      isOutOfStock ||
                      !effectiveWin ||
                      !pickupDate ||
                      addToCart.isPending
                    }
                    loading={addToCart.isPending}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {isOutOfStock
                      ? "Out of Stock"
                      : addToCart.isPending
                        ? "Adding..."
                        : lang === "hi"
                          ? "कार्ट में जोड़ें"
                          : "Add to Cart"}
                  </Button>
                </div>
              )}
            </div>

            {/* Seller card */}
            {product.seller && (
              <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold text-label-lg flex-shrink-0">
                      {product.seller.storeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-label-md text-[var(--color-text)]">
                        {product.seller.storeName}
                      </p>
                      <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                        {product.city}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/sellers/${product.seller.id}`}
                    className="text-label-xs text-kridha-primary hover:underline flex-shrink-0"
                  >
                    View store →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-center">
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      Rating
                    </p>
                    <p className="font-bold text-label-md text-[var(--color-text)]">
                      {product.seller.sellerRating.toFixed(1)} ★
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      Reliability
                    </p>
                    <p className="font-bold text-label-md text-[var(--color-text)]">
                      {product.seller.reliabilityScore}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  icon: <Truck className="w-4 h-4" />,
                  en: "Self pickup",
                  hi: "Self Pickup",
                },
                {
                  icon: <Shield className="w-4 h-4" />,
                  en: "Secure pay",
                  hi: "Secure Payment",
                },
                {
                  icon: <CheckCircle2 className="w-4 h-4" />,
                  en: "Verified seller",
                  hi: "Verified Seller",
                },
              ].map((b, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center"
                >
                  <span className="text-kridha-primary">{b.icon}</span>
                  <span className="text-[10px] text-muted-DEFAULT dark:text-muted-dark font-medium">
                    {lang === "hi" ? b.hi : b.en}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DESCRIPTION ─────────────────────────────────────── */}
        {product.description && (
          <div className="mt-10 bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setDescExpanded((p) => !p)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
            >
              <h2 className="text-label-lg font-bold text-[var(--color-text)]">
                {lang === "hi" ? "Product Details" : "Product Details"}
              </h2>
              {descExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-DEFAULT dark:text-muted-dark" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-DEFAULT dark:text-muted-dark" />
              )}
            </button>
            {descExpanded && (
              <div className="px-5 pb-5">
                <p className="text-label-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {[
                    { l: "Unit", v: product.unit },
                    {
                      l: "Min Order",
                      v: `${product.minOrderQuantity} ${product.unit}`,
                    },
                    {
                      l: "Increment",
                      v: `${product.unitIncrement} ${product.unit}`,
                    },
                    ...(product.maxOrderQuantity
                      ? [
                          {
                            l: "Max Order",
                            v: `${product.maxOrderQuantity} ${product.unit}`,
                          },
                        ]
                      : []),
                  ].map((row) => (
                    <div
                      key={row.l}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3"
                    >
                      <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                        {row.l}
                      </p>
                      <p className="font-semibold text-label-sm text-[var(--color-text)] mt-0.5">
                        {row.v}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ─────────────────────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-h5 font-bold text-[var(--color-text)]">
                {lang === "hi" ? "Reviews" : "Customer Reviews"}
              </h2>
              {avgRating > 0 && (
                <StarRating rating={avgRating} count={reviewCount} size="md" />
              )}
            </div>
          </div>

          {rLoad && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          )}

          {!rLoad && reviews.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <Star className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
              <p className="text-label-md font-semibold text-[var(--color-text)]">
                {lang === "hi" ? "अभी कोई review नहीं" : "No reviews yet"}
              </p>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                {lang === "hi"
                  ? "Order करें और पहले review दें!"
                  : "Order and be the first to review!"}
              </p>
            </div>
          )}

          {!rLoad && reviews.length > 0 && (
            <div className="space-y-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
              <div className="flex gap-3 justify-center mt-4">
                {reviewPage > 1 && (
                  <button
                    onClick={() => setReviewPage((p) => p - 1)}
                    className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] hover:border-kridha-primary hover:text-kridha-primary transition-colors"
                  >
                    ← Prev
                  </button>
                )}
                {reviews.length === 5 && (
                  <button
                    onClick={() => setReviewPage((p) => p + 1)}
                    className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] hover:border-kridha-primary hover:text-kridha-primary transition-colors"
                  >
                    Load more →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
