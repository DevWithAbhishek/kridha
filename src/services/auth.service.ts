import argon2 from "argon2";
import { Prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { tokenService } from "@/services/token.service";
import crypto from "node:crypto";
import {
  SignupInput,
  LoginInput,
  ResetPinInput,
  ResetPinRequestInput,
  RegisterAsSellerInput,
} from "@/schemas/index";
import { gt } from "zod";

export const authService = {
  async signup(input: SignupInput) {
    const existing = await Prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!existing) return ERR.PHONE_EXISTS;

    const hash = await argon2.hash(input.pin, {
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    await Prisma.user.create({
      data: {
        phone: input.phone,
        pin: hash,
        name: input.name,
      },
    });

    return { message: "Account created. Login to Continue" };
  },

  async login(input: LoginInput) {
    const user = await Prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user || !user.pin) return ERR.INVALID_CREDENTIALS;
    if (user.pinLockedUntil && user.pinLockedUntil > new Date())
      return ERR.PIN_LOCKED;

    const valid = await argon2.verify(user.pin, input.pin);
    if (!valid) {
      // rate-limiting the invalid login attempts
      const attempts = user.pinAttempts + 1;
      const lock = attempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000) : null;

      await Prisma.user.update({
        where: { id: user.id },
        data: { pinAttempts: attempts, pinLockedUntil: lock },
      });
      return ERR.INVALID_CREDENTIALS;
    }

    // successful login - reset attempts and issue tokens
    await Prisma.user.update({
      where: { id: user.id },
      data: { pinAttempts: 0, pinLockedUntil: null },
    });

    const tokens = await tokenService.issueTokens(user.id, user.roles, null);
    return tokens;
  },

  //resetPinRequest
  async resetPinRequest(input: ResetPinRequestInput) {
    const user = await Prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) return ERR.PHONE_NOT_FOUND;

    // In a real implementation, generate a secure token, save it with an expiration, and send via SMS
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await Prisma.otpRequest.create({
      data: {
        phone: user.phone,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    // In dev: log OTP. In prod: send via SMS (Phase 2 - Twilio).
    console.log("[DEV] OTP for", user.phone, ":", otp);
    return { message: "Reset PIN link sent to your phone (simulated)." };
  },

  //resetPin
  async resetPin(input: ResetPinInput) {
    const user = await Prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) return ERR.PHONE_NOT_FOUND;

    const otpHash = crypto.createHash("sha256").update(input.otp).digest("hex");
    const record = await Prisma.otpRequest.findFirst({
      where: { phone: input.phone, otpHash, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return ERR.INVALID_OTP;

    const newPinHash = await argon2.hash(input.newPin, {
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    await Prisma.otpRequest.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await Prisma.user.update({
      where: { id: user.id },
      data: { pin: newPinHash },
    });
    await Prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true },
    });

    return { message: "PIN reset successfully. Login to Continue" };
  },

  //registerAsSeller
  async registerAsSeller(userId: string, input: RegisterAsSellerInput) {
    const existingProfile = await Prisma.sellerProfile.findUnique({
      where: { userId, street: input.street },
    });
    if (!existingProfile) return ERR.STORE_EXISTS;

    await Prisma.$transaction(async (tx) => {
      await tx.sellerProfile.create({
        data: {
          userId,
          storeName: input.storeName,
          street: input.street,
          line2: input.line2,
          city: input.city,
          state: input.state,
          pinCode: input.pincode,
          businessType: input.businessType, //Need of any???
          panNumber: input.panNo,
          accountHolderName: input.accountHolderName,
          accountNumber: input.accountNumber,
          ifscCode: input.ifscCode,
          bankName: input.bankName,

          pickupWindows: {
            create: input.pickupWindows.map((w) => ({
              labelEn: w.labelEn,
              labelHi: w.labelHi,
              startTime: w.startTime,
              endTime: w.endTime,

              daysActive: w.daysActive.map(
                (d) =>
                  ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].indexOf(d) +
                  1,
              ),
            })),
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          roles: { push: "SELLER" },
        },
      });
    });

    return { status: "PENDING", bankVerified: false };
  },
};
