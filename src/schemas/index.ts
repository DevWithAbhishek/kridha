// src/schemas/index.ts
import { z } from "zod";

// ── Shared ────────────────────────────────────────────────────────────────

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

// ── 2. Products — Buyer ───────────────────────────────────────────────────

export const GetProductsSchema = z
  .object({
    lat: z.coerce.number().min(8).max(37),
    lng: z.coerce.number().min(68).max(98),
    radius: z.coerce.number().positive().max(50).optional().default(10),
    category: ProductCategoryEnum.optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    isBranded: z.coerce.boolean().optional(),
    dealActive: z.coerce.boolean().optional(),
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

// ── 3. Products — Seller ──────────────────────────────────────────────────

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
    imageUrls: z.array(z.string().url()).max(5).optional(),
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
    imageUrls: z.array(z.string().url()).max(5).optional(),
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

// ── 4. Orders ─────────────────────────────────────────────────────────────

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

// ── 5. Notifications ──────────────────────────────────────────────────────

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
export type GetProductsInput = z.infer<typeof GetProductsSchema>;
export type GetSellerProductsInput = z.infer<typeof GetSellerProductsSchema>;
export type AddProductInput = z.infer<typeof AddProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type GetOrdersInput = z.infer<typeof GetOrdersSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type GetNotificationsInput = z.infer<typeof GetNotificationsSchema>;
