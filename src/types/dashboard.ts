export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "AWAITING_PAYMENT"
  | "READY_FOR_OTP_VERIFICATION"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";
export type Lang = "hi" | "en";
export type Role = "BUYER" | "SELLER" | "ADMIN";
export type ProductCategory =
  | "GRAINS"
  | "DAIRY"
  | "OIL"
  | "SPICES"
  | "FLOUR"
  | "VEGETABLES"
  | "PULSES"
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
export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

export interface User {
  id: string;
  name: string;
  phone: string;
  preferredLang: Lang;
  roles: Role[];
  reliabilityScore: number;
  noShowCount: number;
  creditBalance: number;
  profileImageUrl: string | null;
  city: string | null;
  createdAt: string;
}

export interface SellerProfile {
  userId: string;
  storeName: string;
  city: string;
  state: string;
  street: string;
  pinCode: string;
  profileStatus: string;
  kycStatus: string;
  sellerRating: number;
  sellerRatingCount: number;
  reliabilityScore: number;
  accountNumber: string;
  bankName: string;
}

export interface PriceTier {
  id: string;
  productId: string;
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}

export interface Deal {
  id: string;
  productId: string;
  discountPercent: number;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED";
}

export interface Product {
  id: string;
  sellerId: string;
  nameEn: string;
  nameHi: string | null;
  description: string | null;
  category: ProductCategory;
  unit: ProductUnit;
  unitIncrement: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  available: number;
  imageUrls: string[];
  blurHash: string | null;
  latitude: number;
  longitude: number;
  city: string;
  productStatus: ProductStatus;
  priceTiers: PriceTier[];
  deals: Deal[];
  _count: { orderItems: number };
  distance_km?: number;
  min_price?: number;
  seller?: {
    storeName: string;
    city: string;
    reliabilityScore: number;
    sellerRating: number;
  };
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
  product: { nameEn: string; nameHi: string | null; unit: ProductUnit };
}

export interface StatusEvent {
  id: string;
  subOrderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface SubOrder {
  id: string;
  shortId: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
  status: OrderStatus;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  pickupDate: string;
  pickupDeadline: string;
  deliveryOtp: string | null;
  otpAttempts: number;
  paymentLinkUrl: string | null;
  paymentLinkExpiresAt: string | null;
  seller?: { storeName: string; city: string; reliabilityScore: number };
  buyer?: { name: string; phone: string };
  orderItems: OrderItem[];
  statusHistory: StatusEvent[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  subOrderId: string | null;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  pickupWindowId: string;
  pickupDate: string;
  product: {
    nameEn: string;
    nameHi: string | null;
    unit: ProductUnit;
    imageUrls: string[];
    priceTiers: PriceTier[];
    seller: { storeName: string; city: string };
  };
}

export interface CartSession {
  id: string;
  buyerId: string;
  items: CartItem[];
  summary: {
    totalItems: number;
    totalAmount: number;
    sellerCount: number;
    advanceBreakdown: {
      sellerId: string;
      storeName: string;
      advance: number;
    }[];
  };
}

export interface PickupWindow {
  id: string;
  sellerId: string;
  labelEn: string;
  labelHi: string;
  startTime: string;
  endTime: string;
  daysActive: string[];
  deletedAt: string | null;
}

export interface SavedProduct {
  id: string;
  productId: string;
  type: "FAVOURITE" | "SAVED_FOR_LATER";
  product: Product;
  createdAt: string;
}

export interface Review {
  id: string;
  subOrderId: string;
  productId: string;
  buyerId: string;
  rating: number;
  comment: string | null;
  product: { nameEn: string; nameHi: string | null };
  buyer: { name: string };
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}
