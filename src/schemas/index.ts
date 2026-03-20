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

// daysActive — uppercase throughout, consistent with API contract
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

export const SignupSchema = z.object({
  phone: z
    .string()
    .length(10)
    .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  pin: z
    .string()
    .length(4)
    .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
  name: z.string().min(3).max(40),
});

export const LoginSchema = z.object({
  phone: z
    .string()
    .length(10)
    .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  pin: z
    .string()
    .length(4)
    .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const LogoutSchema = z.object({
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
    // BUG FIXED: was length(10) + /^[0-9]{10}$/ — PIN is 4 digits not 10
    newPin: z
      .string()
      .length(4)
      .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
    confirmPin: z
      .string()
      .length(4)
      .regex(/^[0-9]{4}$/, "PIN must be exactly 4 digits"),
  })
  .refine(
    (data) => data.newPin === data.confirmPin, // === not == (strict equality)
    { message: "confirmPin must match newPin", path: ["confirmPin"] },
  );

// export const — not "export" alone (syntax error)
export const RegisterAsSellerSchema = z.object({
  storeName: z.string().min(2).max(100),
  street: z.string().min(2),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z
    .string()
    .length(6)
    .regex(/^[0-9]{6}$/, "Pincode must be 6 digits"),
  businessType: z.enum([
    "INDIVIDUAL",
    "PROPRIETORSHIP",
    "PARTNERSHIP",
    "PVT_LTD",
  ]),
  gstNo: z.string().optional(),
  panNo: z.string().min(10).max(10),
  accountHolderName: z.string().min(2),
  accountNumber: z.string().min(8).max(18),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
  bankName: z.string().min(2),
  pickupWindows: z
    .array(
      z.object({
        labelEn: z.string().min(1), // BUG FIXED: was "label" — API uses labelEn
        labelHi: z.string().min(1),
        startTime: z.iso.time(), // CORRECT: HH:MM time string — z.iso.time() is right here
        endTime: z.iso.time(),
        daysActive: z.array(DayEnum).min(1), // BUG FIXED: was ["Mon","Tue"] — must be ["MON","TUE"]
      }),
    )
    .min(1, "At least one pickup window is required"),
});

// ── 2. User Profile ───────────────────────────────────────────────────────

export const EditUserProfileSchema = z.object({
  name: z.string().min(2).max(40).optional(),
  street: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(), // BUG FIXED: was "landmark?:" — ? is TS syntax, not Zod
  city: z.string().optional(),
  state: z.string().optional(),
  preferredLang: z.enum(["en", "hi"]).optional(),
});

export const EditUserAvatarSchema = z.object({
  profileImageUrl: z.url(), // z.url() — Zod v4 standalone
  profileImagePublicId: z.string().min(1),
});

// ── 3. Seller Profile ─────────────────────────────────────────────────────

// BUG FIXED: was "export EditSellerProfileSchema" — missing "const"
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
  // BUG FIXED: was missing comma after businessType line
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

// BUG FIXED: was "export EditSellerProfileImageSchema" + plain JS array literal
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

// BUG FIXED: was "export AddPickupWindowSchema" — missing "const"
// z.iso.time() is CORRECT here — startTime/endTime are time-of-day strings "HH:MM"
export const AddPickupWindowSchema = z
  .object({
    labelEn: z.string().min(1),
    labelHi: z.string().min(1),
    startTime: z.iso.time(),
    endTime: z.iso.time(),
    daysActive: z.array(DayEnum).min(1), // BUG FIXED: was ["Mon"] → ["MON"]
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

// BUG FIXED: was "export EditPickupWindowSchema" — missing "const"
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

// BUG FIXED: was "export GetProductWithActiveDealSchema" + z.coerce.float() (does not exist)
export const GetProductsWithActiveDealSchema = z.object({
  lat: z.coerce.number().min(8).max(37), // BUG FIXED: z.coerce.number() not z.coerce.float()
  lng: z.coerce.number().min(68).max(98),
  category: ProductCategoryEnum.optional(),
  sortBy: z
    .enum(["price_asc", "price_desc", "distance"])
    .optional()
    .default("distance"),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
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
    name: z.string().min(2).max(200),
    nameHi: z.string().max(200).optional(),
    description: z.string().optional(),
    category: ProductCategoryEnum,
    isBranded: z.boolean().optional().default(false),
    imageUrls: z.array(z.url()).max(5).optional(),
    blurHash: z.string().optional(),
    available: z.number().positive(),
    minOrderQty: z.number().positive(),
    maxOrderQty: z.number().positive().optional(),
    unit: ProductUnitEnum,
    unitIncrement: z.number().positive(),
    priceTiers: z.array(PriceTierSchema).min(1),
    latitude: z.number().min(8).max(37),
    longitude: z.number().min(68).max(98),
    dealDiscountPercent: z.number().nonnegative().max(100).optional(),
    dealExpiresAt: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.dealDiscountPercent &&
      data.dealDiscountPercent > 0 &&
      !data.dealExpiresAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "dealExpiresAt is required when dealDiscountPercent is set",
        path: ["dealExpiresAt"],
      });
    }
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
    if (data.maxOrderQty !== undefined && data.maxOrderQty < data.minOrderQty) {
      ctx.addIssue({
        code: "custom",
        message: "maxOrderQty must be greater than or equal to minOrderQty",
        path: ["maxOrderQty"],
      });
    }
  });

export const UpdateProductSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
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
    dealDiscountPercent: z.number().nonnegative().max(100).optional(),
    dealExpiresAt: z.coerce.date().optional(),
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
      data.dealDiscountPercent !== undefined &&
      data.dealDiscountPercent > 0 &&
      !data.dealExpiresAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "dealExpiresAt is required when dealDiscountPercent is set",
        path: ["dealExpiresAt"],
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

// BUG FIXED: was "export AddDealToProductSchema" + z.iso.time() + inverted refine + extra })
export const AddDealToProductSchema = z
  .object({
    dealDiscountPercent: z.number().positive().max(100),
    dealExpiresAt: z.coerce.date(), // BUG FIXED: iso.time() is time-only; deal needs full datetime
  })
  .refine(
    (data) => data.dealExpiresAt > new Date(), // BUG FIXED: was <= (inverted — checked past not future)
    { message: "Deal expiry must be in the future", path: ["dealExpiresAt"] },
  );

// BUG FIXED: was "export EditDealToProductSchema" + same iso.time() + inverted refine + no undefined guard
export const EditDealToProductSchema = z
  .object({
    dealDiscountPercent: z.number().positive().max(100).optional(),
    dealExpiresAt: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.dealExpiresAt) return true; // undefined guard — skip if not provided
      return data.dealExpiresAt > new Date(); // BUG FIXED: was <= (inverted)
    },
    { message: "Deal expiry must be in the future", path: ["dealExpiresAt"] },
  );

// BUG FIXED: was "export GetProductWithDealSchema" + missing commas
export const GetSellerDealsSchema = z.object({
  status: z.enum(["active", "expired", "all"]).optional().default("all"),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20), // BUG FIXED: missing comma
});

// ── 8. Saved Products ─────────────────────────────────────────────────────

// BUG FIXED: was "export GetSavedProductsSchema" (no const)
// BUG FIXED: z.enum("FAVORITE",...) → missing [ bracket
// BUG FIXED: "FAVOURITE" not "FAVORITE" — matches Prisma SaveType enum
// BUG FIXED: "SAVED_FOR_LATER " trailing space removed
// BUG FIXED: missing comma on limit line
export const GetSavedProductsSchema = z.object({
  type: z.enum(["FAVOURITE", "SAVED_FOR_LATER"]).optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
});

// BUG FIXED: was "export AddTosavedProductsSchema" (no const, wrong casing)
// BUG FIXED: same enum issues as GetSavedProductsSchema
export const AddToSavedProductsSchema = z.object({
  productId: z.cuid(),
  type: z.enum(["FAVOURITE", "SAVED_FOR_LATER"]),
});

// ── 9. Cart ───────────────────────────────────────────────────────────────

// BUG FIXED: was "export AddItemToCartSchema" (no const)
// BUG FIXED: z.iso.time() for pickupDate — needs full date+time, use z.coerce.date()
// BUG FIXED: refine was <= (inverted — checked past not future)
export const AddItemToCartSchema = z
  .object({
    productId: z.cuid(),
    quantity: z.number().positive(),
    pickupWindowId: z.cuid(),
    pickupDate: z.coerce.date(), // BUG FIXED: iso.time() is time-only; pickup needs full datetime
  })
  .refine(
    (data) => data.pickupDate > new Date(), // BUG FIXED: was <= (inverted)
    { message: "Pickup date must be in the future", path: ["pickupDate"] },
  );

// BUG FIXED: was "export UpdateQuantityCartSchema" (no const)
export const UpdateCartItemSchema = z.object({
  quantity: z.number().positive(),
});

// ── 10. Orders ────────────────────────────────────────────────────────────

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

// ── 11. Reviews ───────────────────────────────────────────────────────────

// BUG FIXED: was "export GetReviewsSchema" (no const)
// BUG FIXED: z.coerce.cuid() does not exist — use z.cuid() standalone
// BUG FIXED: missing comma on limit line
export const GetReviewsSchema = z.object({
  productId: z.cuid().optional(), // BUG FIXED: z.coerce.cuid() does not exist in Zod
  sellerId: z.cuid().optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
});

// BUG FIXED: was "export AddReviewSchema" (no const)
export const AddReviewSchema = z.object({
  orderId: z.cuid(),
  productId: z.cuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// BUG FIXED: was "export UpdateReviewSchema" (no const)
export const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

// ── 12. Notifications ─────────────────────────────────────────────────────

export const GetNotificationsSchema = z.object({
  status: z.enum(["READ", "UNREAD"]).optional(),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(50).optional().default(20),
  sortBy: z
    .enum(["created_asc", "created_desc"])
    .optional()
    .default("created_desc"),
});

// ── Type exports ──────────────────────────────────────────────────────────

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type LogoutInput = z.infer<typeof LogoutSchema>;
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
