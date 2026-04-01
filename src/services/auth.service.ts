// Phone + PIN only. No Truecaller, no Google OAuth.
// Silent signup — PHONE_EXISTS never thrown (enumeration prevention).
// PIN lockout after 5 failed attempts.
// ─────────────────────────────────────────────────────────────────────────────

import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { tokenService } from "./token.service";
import { pickupWindowService } from "./pickup-window.service";
import type {
  SignupInput,
  LoginInput,
  ResetPinRequestInput,
  ResetPinInput,
  RegisterAsSellerInput,
} from "@/schemas";

export const authService = {
  async signup(input: SignupInput): Promise<void> {
    // Silent — same 201 whether phone exists or not (INV-07 / enumeration prevention)
    const existing = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existing) return;

    const pin = await argon2.hash(input.pin);
    await prisma.user.create({
      data: { phone: input.phone, pin, name: input.name, roles: ["BUYER"] },
    });
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    // Same error for wrong phone and wrong PIN — prevents enumeration
    if (!user || !user.pin) throw ERR.INVALID_CREDENTIALS;
    if (user.pinLockedUntil && user.pinLockedUntil > new Date())
      throw ERR.PIN_LOCKED;

    const valid = await argon2.verify(user.pin, input.pin);
    if (!valid) {
      const attempts = user.pinAttempts + 1;
      const lockUntil =
        attempts >= 5 ? new Date(Date.now() + 10 * 60_000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { pinAttempts: attempts, pinLockedUntil: lockUntil },
      });
      throw ERR.INVALID_CREDENTIALS;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pinAttempts: 0, pinLockedUntil: null },
    });

    const tokens = await tokenService.issueTokens(user.id, user.roles);
    return {
      tokens,
      user: {
        id: user.id,
        name: user.name,
        roles: user.roles,
        preferredLang: user.preferredLang,
      },
    };
  },

  async resetPinRequest(input: ResetPinRequestInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) throw ERR.PHONE_NOT_FOUND;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    await prisma.otpRequest.create({
      data: {
        phone: input.phone,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    // Phase 2: send via Twilio. Dev: log to console.
    console.log(`[DEV OTP] phone=${input.phone} otp=${otp}`);
  },

  async resetPin(input: ResetPinInput): Promise<void> {
    const otpHash = crypto.createHash("sha256").update(input.otp).digest("hex");
    const record = await prisma.otpRequest.findFirst({
      where: {
        phone: input.phone,
        otpHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) throw ERR.INVALID_OTP;

    const newPin = await argon2.hash(input.newPin);

    await prisma.$transaction([
      prisma.otpRequest.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { phone: input.phone },
        data: { pin: newPin },
      }),
      // Revoke all sessions — force re-login after PIN change
      prisma.refreshToken.updateMany({
        where: { user: { phone: input.phone } },
        data: { revoked: true },
      }),
    ]);
  },

  async registerAsSeller(userId: string, input: RegisterAsSellerInput) {
    const conflict = await prisma.sellerProfile.findFirst({
      where: { storeName: input.storeName, street: input.street },
    });
    if (conflict) throw ERR.STORE_EXISTS;

    await prisma.$transaction(async (tx) => {
      await tx.sellerProfile.create({
        data: {
          userId,
          storeName: input.storeName,
          street: input.street,
          line2: input.line2 ?? null,
          landmark: input.landmark ?? null,
          city: input.city,
          state: input.state,
          pinCode: input.pincode,
          businessType: input.businessType as never,
          gstNumber: input.gstNo ?? null,
          panNumber: input.panNo,
          accountHolderName: input.accountHolderName,
          accountNumber: input.accountNumber,
          ifscCode: input.ifscCode,
          bankName: input.bankName,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { roles: { push: "SELLER" } },
      });
    });

    // Create default pickup windows after transaction
    await pickupWindowService.createDefaults(userId);

    return { status: "PENDING", bankVerified: false };
  },
};
