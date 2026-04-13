import type {
  User,
  SellerProfile,
  Product,
  SubOrder,
  Notification,
  CartSession,
  SavedProduct,
  Review,
} from "@/types/dashboard";

// ─────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────

export const DUMMY_USER: User = {
  id: "user-1",
  name: "Arjun Sharma",
  phone: "9876540099",
  preferredLang: "hi",
  roles: ["BUYER"],
  reliabilityScore: 95,
  noShowCount: 0,
  creditBalance: 0,
  isFlagged: false,
  profileImageUrl: null,
  street: null,
  line2: null,
  landmark: null,
  city: "Lucknow",
  state: "Uttar Pradesh",
  createdAt: "2023-01-01T00:00:00Z",
};

// ─────────────────────────────────────────────────────────────
// SELLER PROFILE
// ─────────────────────────────────────────────────────────────

export const DUMMY_SELLER_PROFILE: SellerProfile = {
  id: "seller-1",
  userId: "user-2",

  storeName: "Gupta Oil Mill",
  street: "MG Road",
  line2: null,
  landmark: null,
  city: "Lucknow",
  state: "Uttar Pradesh",
  pinCode: "226001",

  storeImages: [],

  latitude: null,
  longitude: null,

  businessType: "INDIVIDUAL",
  gstNumber: null,
  panNumber: null,

  kycStatus: "VERIFIED",
  profileStatus: "VERIFIED",

  accountHolderName: "Gupta Traders",
  accountNumber: "****6677",
  ifscCode: null,
  bankName: "State Bank of India",
  bankVerified: true,

  sellerRating: 4.7,
  sellerRatingCount: 38,
  reliabilityScore: 92,

  createdAt: "2023-01-01T00:00:00Z",
};

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

export const DUMMY_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    sellerId: "seller-1",
    nameEn: "Mustard Oil",
    nameHi: "सरसों का तेल",
    description: "Pure mustard oil",
    category: "OIL",
    unit: "LITRE",
    unitIncrement: 1,
    minOrderQuantity: 1,
    maxOrderQuantity: 100,
    available: 200,
    imageUrls: ["/images/mustard-oil.jpg"],
    blurHash: null,
    latitude: 26.8467,
    longitude: 80.9462,
    city: "Lucknow",
    productStatus: "ACTIVE",
    priceTiers: [
      {
        id: "tier-1",
        productId: "prod-1",
        minQty: 1,
        maxQty: 10,
        pricePerUnit: 180,
      },
    ],
    deals: [],
    seller: {
      storeName: "Gupta Oil Mill",
      city: "Lucknow",
      reliabilityScore: 92,
      sellerRating: 4.7,
    },
    createdAt: "2023-01-01T00:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────
// SUBORDERS
// ─────────────────────────────────────────────────────────────

export const DUMMY_SUBORDERS: SubOrder[] = [
  {
    id: "sub-1",
    shortId: "KR-4F2A1B",
    orderId: "order-1",
    sellerId: "seller-1",
    buyerId: "user-1",

    status: "CONFIRMED",

    totalAmount: 4500,
    advanceAmount: 225,
    remainingAmount: 4275,

    pickupDate: new Date().toISOString(),
    pickupDeadline: new Date().toISOString(),

    deliveryOtp: null,
    otpAttempts: 0,

    paymentLinkUrl: null,
    paymentLinkExpiresAt: null,

    seller: {
      storeName: "Gupta Oil Mill",
      city: "Lucknow",
      reliabilityScore: 92,
    },

    buyer: {
      name: "Arjun Sharma",
      phone: "9876540099",
    },

    orderItems: [
      {
        id: "item-1",
        productId: "prod-1",
        quantity: 25,
        unitPrice: 180,
        subTotal: 4500,
        product: {
          nameEn: "Mustard Oil",
          nameHi: "सरसों का तेल",
          unit: "LITRE",
        },
      },
    ],

    createdAt: "2023-01-01T00:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export const DUMMY_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    userId: "user-1",
    title: "Order Confirmed",
    body: "Your order KR-4F2A1B has been confirmed.",
    type: "ORDER_CONFIRMED",
    read: false,
    subOrderId: "sub-1",
    createdAt: "2023-01-01T00:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────────────────────

export const DUMMY_CART: CartSession = {
  id: "cart-1",
  userId: "user-1",
  totalAdvance: 45,
  items: [
    {
      id: "cart-item-1",
      productId: "prod-1",
      quantity: 5,
      unitPrice: 180,
      subTotal: 900,
      pickupWindowId: "window-1",
      pickupDate: new Date().toISOString(),
      product: {
        nameEn: "Mustard Oil",
        nameHi: "सरसों का तेल",
        unit: "LITRE",
        imageUrls: ["/images/mustard-oil.jpg"],
        seller: {
          storeName: "Gupta Oil Mill",
          city: "Lucknow",
        },
      },
    },
  ],
  createdAt: "2023-01-01T00:00:00Z",
};

// ─────────────────────────────────────────────────────────────
// SAVED PRODUCTS
// ─────────────────────────────────────────────────────────────

export const DUMMY_SAVED: SavedProduct[] = [
  {
    id: "saved-1",
    productId: "prod-1",
    type: "FAVOURITE",
    product: DUMMY_PRODUCTS[0],
    createdAt: "2023-01-01T00:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────

export const DUMMY_REVIEWS: Review[] = [
  {
    id: "review-1",
    subOrderId: "sub-1",
    productId: "prod-1",
    rating: 5,
    comment: "Excellent quality!",
    product: {
      nameEn: "Mustard Oil",
      nameHi: "सरसों का तेल",
    },
    buyer: {
      name: "Arjun Sharma",
    },
    createdAt: "2023-01-01T00:00:00Z",
  },
];

export const DUMMY_SELLER_ORDERS: SubOrder[] = [
  {
    id: "sub-2",
    shortId: "KR-9A1C3D",
    orderId: "order-2",
    sellerId: "seller-1",
    buyerId: "user-2",

    status: "CONFIRMED",

    totalAmount: 3600,
    advanceAmount: 180,
    remainingAmount: 3420,

    pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),

    pickupDeadline: new Date(
      Date.now() + 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
    ).toISOString(),

    deliveryOtp: null,
    otpAttempts: 0,

    paymentLinkUrl: null,
    paymentLinkExpiresAt: null,

    buyer: {
      name: "Ravi Kumar",
      phone: "9876540088",
    },

    orderItems: [
      {
        id: "item-2",
        productId: "prod-1",
        quantity: 20,
        unitPrice: 180,
        subTotal: 3600,
        product: {
          nameEn: "Mustard Oil",
          nameHi: "सरसों का तेल",
          unit: "LITRE",
        },
      },
    ],

    createdAt: "2023-01-01T00:00:00Z",
  },

  {
    id: "sub-3",
    shortId: "KR-7E2F4B",
    orderId: "order-3",
    sellerId: "seller-1",
    buyerId: "user-3",

    status: "AWAITING_PAYMENT",

    totalAmount: 5400,
    advanceAmount: 270,
    remainingAmount: 5130,

    pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),

    pickupDeadline: new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
    ).toISOString(),

    deliveryOtp: null,
    otpAttempts: 0,

    paymentLinkUrl: "https://rzp.io/payment-link",
    paymentLinkExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),

    buyer: {
      name: "Priya Singh",
      phone: "9876540077",
    },

    orderItems: [
      {
        id: "item-3",
        productId: "prod-1",
        quantity: 30,
        unitPrice: 180,
        subTotal: 5400,
        product: {
          nameEn: "Mustard Oil",
          nameHi: "सरसों का तेल",
          unit: "LITRE",
        },
      },
    ],

    createdAt: "2023-01-01T00:00:00Z",
  },
];