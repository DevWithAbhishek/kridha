// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

export type Role = "BUYER" | "SELLER" | "ADMIN";

export type Language = "en" | "hi";

export type BusinessType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "PVT_LTD";

export type SellerStatus = "PENDING" | "VERIFIED" | "DEACTIVATED";

export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type ProductCategory =
  | "GRAINS"
  | "DAIRY"
  | "OIL"
  | "SPICES"
  | "VEGETABLES"
  | "FRUITS"
  | "PULSES"
  | "FLOUR"
  | "BEVERAGES"
  | "OTHER";

export type ProductUnit =
  | "KG"
  | "GRAM"
  | "LITRE"
  | "ML"
  | "PIECE"
  | "DOZEN"
  | "QUINTAL"
  | "TON"
  | "BUNDLE";

export type ProductStatus = "ACTIVE" | "DELETED";

export type DealStatus = "ACTIVE" | "EXPIRED";

export type SaveType = "FAVOURITE" | "SAVED_FOR_LATER";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "AWAITING_PAYMENT"
  | "READY_FOR_OTP_VERIFICATION"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type PaymentType = "ADVANCE" | "REMAINING";

export type PaymentStatus = "CREATED" | "PAID" | "PENDING" | "FAILED";

export type PayoutStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

export type NotificationType =
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "READY_FOR_PICKUP"
  | "AWAITING_PAYMENT"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED"
  | "REFUND_INITIATED"
  | "NO_SHOW_PENALTY"
  | "DISPUTE_RAISED"
  | "NEW_ORDER"
  | "FLAGGED_BUYER"
  | "DEAL_EXPIRED";

export type RefundStatus = "INITIATED" | "PROCESSED" | "FAILED";

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

// ─────────────────────────────────────────────────────────────
// CORE MODELS
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  name: string;

  street?: string | null;
  line2?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;

  profileImageUrl?: string | null;
  preferredLang: Language;

  roles: Role[];

  reliabilityScore: number;
  noShowCount: number;
  creditBalance: number;
  isFlagged: boolean;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface SellerProfile {
  id: string;
  userId: string;

  storeName: string;
  street: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pinCode: string;

  storeImages: { url: string; publicId: string }[];

  latitude?: number | null;
  longitude?: number | null;

  businessType: BusinessType;
  gstNumber?: string | null;
  panNumber?: string | null;

  kycStatus: KycStatus;
  profileStatus: SellerStatus;

  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  bankVerified: boolean;

  sellerRating: number;
  sellerRatingCount: number;
  reliabilityScore: number;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  sellerId: string;

  nameEn: string;
  nameHi?: string | null;
  description?: string | null;

  category: ProductCategory;

  unit: ProductUnit;
  unitIncrement: number;
  minOrderQuantity: number;
  maxOrderQuantity?: number | null;

  available: number;

  imageUrls: string[];
  blurHash?: string | null;

  latitude: number;
  longitude: number;
  city: string;

  productStatus: ProductStatus;

  priceTiers: PriceTier[];
  deals: Deal[];

  seller?: {
    storeName: string;
    city: string;
    reliabilityScore: number;
    sellerRating: number;
  };

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface PriceTier {
  id: string;
  productId: string;
  minQty: number;
  maxQty?: number | null;
  pricePerUnit: number;
}

// ─────────────────────────────────────────────────────────────

export interface Deal {
  id: string;
  productId: string;
  sellerId: string;

  discountPercent: number;
  expiresAt: string;
  status: DealStatus;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface PickupWindow {
  id: string;
  sellerId: string;
  labelEn: string;
  labelHi: string;
  startTime: string;
  endTime: string;
  daysActive: Day[]; // ✅ correct
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;

  productId: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;

  pickupWindowId: string;
  pickupDate: string;

  product: {
    nameEn: string;
    nameHi?: string | null;
    unit: ProductUnit;
    imageUrls: string[];
    seller: { storeName: string; city: string };
  };
}

// ─────────────────────────────────────────────────────────────

export interface CartSession {
  id: string;
  userId: string;

  totalAdvance?: number | null;

  items: CartItem[];

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Order {
  id: string;

  buyerId: string;

  totalAmount: number;
  subTotal: number;
  platformFee: number;
  advanceAmount: number;

  createdAt: string;

  subOrders: SubOrder[];
}

// ─────────────────────────────────────────────────────────────

export interface SubOrder {
  id: string;
  shortId: string;

  orderId: string;
  sellerId: string;
  buyerId?: string;

  status: OrderStatus;

  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;

  pickupDate: string;
  pickupDeadline: string;

  deliveryOtp?: string | null;
  otpAttempts: number;

  paymentLinkUrl?: string | null;
  paymentLinkExpiresAt?: string | null;

  seller?: {
    storeName: string;
    city: string;
    reliabilityScore: number;
  };

  buyer?: {
    name: string;
    phone: string;
  };

  pickupWindow: PickupWindow,
  orderItems: OrderItem[];

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;

  productId: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;

  product: {
    nameEn: string;
    nameHi?: string | null;
    unit: ProductUnit;
  };
}

// ─────────────────────────────────────────────────────────────

export interface Payment {
  id: string;

  subOrderId: string;

  type: PaymentType;
  status: PaymentStatus;

  amount: number;

  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Payout {
  id: string;

  subOrderId: string;
  sellerId: string;

  amount: number;
  status: PayoutStatus;

  processedAt?: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Refund {
  id: string;

  subOrderId: string;

  amount: number;
  reason?: string | null;

  razorpayRefundId?: string | null;
  status: RefundStatus;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Review {
  id: string;

  subOrderId: string;
  productId: string;

  rating: number;
  comment?: string | null;

  product: {
    nameEn: string;
    nameHi?: string | null;
  };

  buyer: {
    name: string;
  };

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;

  userId: string;
  subOrderId?: string | null;

  title: string;
  body: string;

  type: NotificationType;
  read: boolean;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// GENERIC API TYPES
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface SavedProduct {
  id: string;
  productId: string;
  type: SaveType;

  product: Product;

  createdAt: string;
}

// src/types/dashboard.ts — ADD these types / replace Product with SellerProduct
// The old Product type is too narrow. Use SellerProduct for seller dashboard.
// Keep Product for buyer-side if already defined elsewhere.

// SellerProduct — returned by GET /api/products/mine
// Matches the shape from productRepo.findBySeller + the totalOrders mapping in route.ts
export interface ActiveDeal {
  id:              string;
  discountPercent: number;
  expiresAt:       string;
  status:          'ACTIVE' | 'EXPIRED';
}

export interface SellerProduct {
  id:               string;
  nameEn:           string;
  nameHi:           string | null;
  description:      string | null;
  category:         string;
  unit:             string;
  unitIncrement:    number;
  isBranded:        boolean;
  available:        number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  imageUrls:        string[];
  blurHash:         string | null;
  productStatus:    'ACTIVE' | 'DELETED';
  priceTiers:       PriceTier[];
  deals:            ActiveDeal[];
  totalOrders:      number;  // mapped from _count.orderItems in route.ts
  createdAt:        string;
  updatedAt:        string;
  // location — not returned by findBySeller, no need to map
}
