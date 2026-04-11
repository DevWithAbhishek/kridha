// src/schemas/index.ts
import { z } from "zod";

// ── Shared enums ──────────────────────────────────────────────────────────

const ProductCategoryEnum = z.enum([
  "GRAINS",
  "DAIRY",
  "OIL",
  "SPICES",
  "VEGETABLES",
  "FRUITS",
  "PULSES",
  "FLOUR",
  "BEVERAGES",
  "OTHER",
]);

const ProductUnitEnum = z.enum([
  "KG",
  "GRAM",
  "LITRE",
  "ML",
  "PIECE",
  "DOZEN",
  "QUINTAL",
  "TON",
  "BUNDLE",
]);

// daysActive — uppercase, consistent with Prisma schema and API contract
const DayEnum = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

const PriceTierSchema = z
  .object({
    minQty: z.number().positive(),
    maxQty: z.number().positive().optional(),
    pricePerUnit: z.number().positive(),
  })
  .refine((data) => data.maxQty === undefined || data.minQty <= data.maxQty, {
    message: "minQty must be less than or equal to maxQty",
    path: ["maxQty"],
  });

// ── 1. Auth ───────────────────────────────────────────────────────────────

export const SignupSchema = z
  .object({
    phone: z
      .string()
      .min(1, "PHONE_REQUIRED")
      .length(10, "PHONE_LENGTH")
      .regex(/^[0-9]{10}$/, "PHONE_INVALID"),
    pin: z
      .string()
      .min(1, "PIN_REQUIRED")
      .length(4, "PIN_LENGTH")
      .regex(/^[0-9]{4}$/, "PIN_LENGTH"),
    confirmPin: z.string().length(4, "PIN_LENGTH"),
    name: z
      .string()
      .min(1, "NAME_REQUIRED")
      .min(3, "NAME_TOO_SHORT")
      .max(40, "NAME_TOO_LONG"),
  })
  .refine((data) => data.pin === data.confirmPin, {
    path: ["confirmPin"],
    message: "PIN_MISMATCH",
  });

export const LoginSchema = z.object({
  phone: z
    .string()
    .min(1, "PHONE_REQUIRED")
    .length(10, "PHONE_LENGTH")
    .regex(/^[0-9]{10}$/, "PHONE_INVALID"),
  pin: z
    .string()
    .min(1, "PIN_REQUIRED")
    .length(4, "PIN_LENGTH")
    .regex(/^[0-9]{4}$/, "PIN_LENGTH"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const ResetPinRequestSchema = z.object({
  phone: z
    .string()
    .length(10)
    .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
});

export const ResetPinSchema = z
  .object({
    phone: z
      .string()
      .length(10)
      .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
    otp: z
      .string()
      .length(4)
      .regex(/^[0-9]{4}$/, "OTP must be exactly 4 digits"),
    newPin: z
      .string()
      .length(4)
      .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
    confirmPin: z
      .string()
      .length(4)
      .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: "confirmPin must match newPin",
    path: ["confirmPin"],
  });

export const RegisterAsSellerSchema = z.object({
  storeName: z.string().min(3, "STORE_NAME_SHORT").max(100),
  street: z.string().min(5, "STREET_SHORT").max(200),
  line2: z.string().max(100).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2, "CITY_SHORT").max(50),
  state: z.string().min(2, "STATE_SHORT").max(50),
  pincode: z
    .string()
    .length(6, "PINCODE_INVALID")
    .regex(/^\d{6}$/, "PINCODE_INVALID"),
  businessType: z.enum([
    "INDIVIDUAL",
    "PROPRIETORSHIP",
    "PARTNERSHIP",
    "PVT_LTD",
  ]),
  gstNo: z.string().max(15).optional(),
  panNo: z
    .string()
    .transform((val) => val.toUpperCase())
    .refine((val) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
      message: "PAN_INVALID",
    }),
  accountHolderName: z.string().min(3, "ACCOUNT_NAME_SHORT").max(100),
  accountNumber: z.string().min(9, "ACCOUNT_INVALID").max(18),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC_INVALID"),
  bankName: z.string().min(3, "BANK_SHORT").max(100),
  pickupWindows: z
    .array(
      z.object({
        labelEn: z.string().min(1),
        labelHi: z.string().min(1),
        startTime: z.iso.time(), // HH:MM time string — z.iso.time() correct here
        endTime: z.iso.time(),
        daysActive: z.array(DayEnum).min(1),
      }),
    )
    .min(1, "At least one pickup window is required"),
});

// ── 2. User Profile ───────────────────────────────────────────────────────

export const EditUserProfileSchema = z.object({
  name: z.string().min(2).max(40).optional(),
  street: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  preferredLang: z.enum(["en", "hi"]).optional(),
});

export const EditUserAvatarSchema = z.object({
  profileImageUrl: z.url(),
  profileImagePublicId: z.string().min(1),
});

// ── 3. Seller Profile ─────────────────────────────────────────────────────

export const EditSellerProfileSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  street: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .length(6)
    .regex(/^[0-9]{6}$/)
    .optional(),
  businessType: z
    .enum(["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "PVT_LTD"])
    .optional(),
  gstNo: z.string().optional(),
  panNo: z.string().min(10).max(10).optional(),
  accountHolderName: z.string().min(2).optional(),
  accountNumber: z.string().min(8).max(18).optional(),
  ifscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .optional(),
  bankName: z.string().min(2).optional(),
});

export const EditSellerProfileImageSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.url(),
        publicId: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

// ── 4. Pickup Windows ─────────────────────────────────────────────────────

export const AddPickupWindowSchema = z
  .object({
    labelEn: z.string().min(1),
    labelHi: z.string().min(1),
    startTime: z.iso.time(),
    endTime: z.iso.time(),
    daysActive: z.array(DayEnum).min(1),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const EditPickupWindowSchema = z
  .object({
    labelEn: z.string().min(1).optional(),
    labelHi: z.string().min(1).optional(),
    startTime: z.iso.time().optional(),
    endTime: z.iso.time().optional(),
    daysActive: z.array(DayEnum).min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) return data.startTime < data.endTime;
      return true;
    },
    { message: "endTime must be after startTime", path: ["endTime"] },
  );

// ── 5. Products — Buyer ───────────────────────────────────────────────────

export const GetProductsSchema = z
  .object({
    q: z.string().optional(),
    lat: z.coerce.number().min(8).max(37),
    lng: z.coerce.number().min(68).max(98),
    radius: z.coerce.number().positive().max(50).optional().default(10),
    category: ProductCategoryEnum.optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    isBranded: z.coerce.boolean().optional(),
    dealActive: z.coerce.boolean().optional(),
    sellerId: z.string().optional(),
    sortBy: z
      .enum(["price_asc", "price_desc", "distance"])
      .optional()
      .default("distance"),
    page: z.coerce.number().positive().optional().default(1),
    limit: z.coerce.number().positive().max(50).optional().default(20),
  })
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "minPrice must be less than or equal to maxPrice",
      path: ["maxPrice"],
    },
  );

export const GetProductsWithActiveDealSchema = z.object({
  lat: z.coerce.number().min(8).max(37),
  lng: z.coerce.number().min(68).max(98),
  category: ProductCategoryEnum.optional(),
  sortBy: z
    .enum(["price_asc", "price_desc", "distance"])
    .optional()
    .default("distance"),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
  radius: z.coerce.number().positive().max(50).optional().default(10),
  // 🔥 Add ALL fields used in service
  isBranded: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  q: z.string().optional(),
});

// ── 6. Products — Seller ──────────────────────────────────────────────────

export const GetSellerProductsSchema = z.object({
  category: ProductCategoryEnum.optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
  status: z.enum(["ACTIVE", "DELETED"]).optional().default("ACTIVE"),
});

export const AddProductSchema = z
  .object({
    // nameEn not name — matches Prisma Product.nameEn field
    nameEn: z.string().min(2).max(200),
    nameHi: z.string().max(200).optional(),
    description: z.string().optional(),
    category: ProductCategoryEnum,
    isBranded: z.boolean().optional().default(false),
    imageUrls: z.array(z.url()).max(5).optional(),
    blurHash: z.string().optional(),
    available: z.number().positive(),
    minOrderQuantity: z.number().positive(),
    maxOrderQuantity: z.number().positive().optional(),
    unit: ProductUnitEnum,
    unitIncrement: z.number().positive(),
    priceTiers: z.array(PriceTierSchema).min(1),
    latitude: z.number().min(8).max(37),
    longitude: z.number().min(68).max(98),
    // Deal fields removed — deals are created via POST /api/products/:id/deal
  })
  .superRefine((data, ctx) => {
    if (
      data.imageUrls &&
      data.imageUrls.length > 0 &&
      (!data.blurHash || data.blurHash.trim() === "")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "blurHash is required when imageUrls are provided",
        path: ["blurHash"],
      });
    }
    if (
      data.maxOrderQuantity !== undefined &&
      data.maxOrderQuantity < data.minOrderQuantity
    ) {
      ctx.addIssue({
        code: "custom",
        message: "maxOrderQty must be greater than or equal to minOrderQty",
        path: ["maxOrderQty"],
      });
    }
  });

export const UpdateProductSchema = z
  .object({
    nameEn: z.string().min(2).max(200).optional(),
    nameHi: z.string().max(200).optional(),
    description: z.string().optional(),
    category: ProductCategoryEnum.optional(),
    isBranded: z.boolean().optional(),
    imageUrls: z.array(z.url()).max(5).optional(),
    blurHash: z.string().optional(),
    available: z.number().positive().optional(),
    minOrderQty: z.number().positive().optional(),
    maxOrderQty: z.number().positive().optional(),
    unit: ProductUnitEnum.optional(),
    unitIncrement: z.number().positive().optional(),
    priceTiers: z.array(PriceTierSchema).min(1).optional(),
    // Deal fields not here — use PATCH /api/products/:id/deal
  })
  .superRefine((data, ctx) => {
    if (
      data.imageUrls &&
      data.imageUrls.length > 0 &&
      (!data.blurHash || data.blurHash.trim() === "")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "blurHash is required when imageUrls are provided",
        path: ["blurHash"],
      });
    }
    if (
      data.maxOrderQty !== undefined &&
      data.minOrderQty !== undefined &&
      data.maxOrderQty < data.minOrderQty
    ) {
      ctx.addIssue({
        code: "custom",
        message: "maxOrderQty must be greater than or equal to minOrderQty",
        path: ["maxOrderQty"],
      });
    }
  });

// ── 7. Deals ──────────────────────────────────────────────────────────────

export const AddDealToProductSchema = z
  .object({
    discountPercent: z.number().positive().max(100),
    expiresAt: z.coerce.date(),
  })
  .refine((data) => data.expiresAt > new Date(), {
    message: "Deal expiry must be in the future",
    path: ["expiresAt"],
  });

export const EditDealToProductSchema = z
  .object({
    discountPercent: z.number().positive().max(100).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.expiresAt) return true;
      return data.expiresAt > new Date();
    },
    { message: "Deal expiry must be in the future", path: ["expiresAt"] },
  );

export const GetSellerDealsSchema = z.object({
  status: z.enum(["active", "expired", "all"]).optional().default("all"),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
});

// ── 8. Saved Products ─────────────────────────────────────────────────────

export const GetSavedProductsSchema = z.object({
  type: z.enum(["FAVOURITE", "SAVED_FOR_LATER"]).optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
});

export const AddToSavedProductsSchema = z.object({
  productId: z.cuid(),
  type: z.enum(["FAVOURITE", "SAVED_FOR_LATER"]),
});

// ── 9. Cart ───────────────────────────────────────────────────────────────

export const AddItemToCartSchema = z
  .object({
    productId: z.cuid(),
    quantity: z.number().positive(),
    pickupWindowId: z.cuid(),
    pickupDate: z.coerce.date(),
  })
  .refine((data) => data.pickupDate > new Date(), {
    message: "Pickup date must be in the future",
    path: ["pickupDate"],
  });

export const UpdateCartItemSchema = z.object({
  quantity: z.number().positive(),
});

// ── 10. Orders ────────────────────────────────────────────────────────────

// POST /api/orders — single-seller direct order (not via cart)
// Multi-seller checkout uses POST /api/cart/checkout (no body)
export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.cuid(),
        quantity: z.number().positive(),
        pickupWindowId: z.cuid(),
        pickupDate: z.coerce
          .date()
          .refine((d) => d > new Date(), "Pickup date must be in the future"),
      }),
    )
    .min(1, "At least one item is required"),
  // cartSessionId links to parent CartSession for multi-seller checkout
  // When coming from POST /api/cart/checkout this is set server-side
  // When using POST /api/orders directly this is optional
  cartSessionId: z.cuid().optional(),
});

export const GetOrdersSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "AWAITING_PAYMENT",
      "READY_FOR_OTP_VERIFICATION",
      "COMPLETED",
      "CANCELLED",
      "DISPUTED",
    ])
    .optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
  sortBy: z
    .enum(["created_asc", "created_desc"])
    .optional()
    .default("created_desc"),
});

export const CancelOrderSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export const VerifyOtpSchema = z.object({
  otp: z
    .string()
    .length(4)
    .regex(/^[0-9]{4}$/, "OTP must be exactly 4 digits"),
});

// ── 11. Reviews & Notifications
export const AddStoreImagesSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(5),
});
export type AddStoreImagesInput = z.infer<typeof AddStoreImagesSchema>;

export const GetNotificationsSchema = z.object({
  status: z.enum(["READ", "UNREAD"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["created_asc", "created_desc"]).default("created_desc"),
});

export const AddReviewSchema = z.object({
  subOrderId: z.string().cuid(),
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const UpdateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  })
  .refine((d) => d.rating !== undefined || d.comment !== undefined, {
    message: "At least one of rating or comment must be provided",
  });

export const GetReviewsSchema = z.object({
  productId: z.string().cuid().optional(),
  sellerId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Type exports ──────────────────────────────────────────────────────────

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ResetPinRequestInput = z.infer<typeof ResetPinRequestSchema>;
export type ResetPinInput = z.infer<typeof ResetPinSchema>;
export type RegisterAsSellerInput = z.infer<typeof RegisterAsSellerSchema>;
export type EditUserProfileInput = z.infer<typeof EditUserProfileSchema>;
export type EditUserAvatarInput = z.infer<typeof EditUserAvatarSchema>;
export type EditSellerProfileInput = z.infer<typeof EditSellerProfileSchema>;
export type EditSellerProfileImageInput = z.infer<
  typeof EditSellerProfileImageSchema
>;
export type AddPickupWindowInput = z.infer<typeof AddPickupWindowSchema>;
export type EditPickupWindowInput = z.infer<typeof EditPickupWindowSchema>;
export type GetProductsInput = z.infer<typeof GetProductsSchema>;
export type GetProductsWithActiveDealInput = z.infer<
  typeof GetProductsWithActiveDealSchema
>;
export type GetSellerProductsInput = z.infer<typeof GetSellerProductsSchema>;
export type AddProductInput = z.infer<typeof AddProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type AddDealToProductInput = z.infer<typeof AddDealToProductSchema>;
export type EditDealToProductInput = z.infer<typeof EditDealToProductSchema>;
export type GetSellerDealsInput = z.infer<typeof GetSellerDealsSchema>;
export type GetSavedProductsInput = z.infer<typeof GetSavedProductsSchema>;
export type AddToSavedProductsInput = z.infer<typeof AddToSavedProductsSchema>;
export type AddItemToCartInput = z.infer<typeof AddItemToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type GetOrdersInput = z.infer<typeof GetOrdersSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type GetReviewsInput = z.infer<typeof GetReviewsSchema>;
export type AddReviewInput = z.infer<typeof AddReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type GetNotificationsInput = z.infer<typeof GetNotificationsSchema>;
