
// src/schemas/admin.schemas.ts

import { z } from "zod";

export const AdminLoginSchema = z.object({
  email:    z.email(),
  password: z.string().min(12).max(128),
});
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

export const AdminVerifySellerSchema = z.object({
  note: z.string().max(500).optional(),
});
export type AdminVerifySellerInput = z.infer<typeof AdminVerifySellerSchema>;

export const AdminCreateSchema = z.object({
  email:    z.string().email(),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  name:     z.string().min(2).max(60),
  role:     z.enum(["REVIEWER", "SUPER_ADMIN"]),
});
export type AdminCreateInput = z.infer<typeof AdminCreateSchema>;

export const AdminSuspendSchema = z.object({
  note: z.string().min(10).max(500), // reason is required for suspensions
});
