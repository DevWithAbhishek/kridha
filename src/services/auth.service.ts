import argon2 from "argon2";
import { prisma } from "@/lib/db";
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
import { userRepo } from "@/repo/user.repo";
import { authRepo } from "@/repo/auth.repo";
import { tokenRepo } from "@/repo/token.repo";
import { otpPinRepo } from "@/repo/otpPin.repo";

export const authService = {
  async signup(input: SignupInput) {
    const existing = await userRepo.findUserByPhone(input.phone);
    if (!existing) throw ERR.PHONE_EXISTS;

    const hash = await argon2.hash(input.pin, {
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });
    await userRepo.createUser(input.phone, hash, input.name);
    return { message: "Account created. Login to Continue" };
  },

  async login(input: LoginInput) {
    const user = await userRepo.findUserByPhone(input.phone);
    if (!user || !user.pin) throw ERR.INVALID_CREDENTIALS;
    if (user.pinLockedUntil && user.pinLockedUntil > new Date())
      throw ERR.PIN_LOCKED;

    const valid = await argon2.verify(user.pin, input.pin);
    if (!valid) {
      // rate-limiting the invalid login attempts
      const attempts = user.pinAttempts + 1;
      const lock = attempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000) : null;

      await authRepo.updateUserLoginAttempts(user.id, attempts, lock);
      throw ERR.INVALID_CREDENTIALS;
    }

    // successful login - reset attempts and issue tokens
    await authRepo.updateUserLoginAttempts(user.id, 0, null);

    const tokens = await tokenService.issueTokens(user.id, user.roles, null);
    return tokens;
  },

  //resetPinRequest
  async resetPinRequest(input: ResetPinRequestInput) {
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) throw ERR.PHONE_NOT_FOUND;

    // In a real implementation, generate a secure token, save it with an expiration, and send via SMS
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await otpPinRepo.createResetOtpRequest(
      input.phone,
      otpHash,
      new Date(Date.now() + 10 * 60 * 1000),
    );
    // In dev: log OTP. In prod: send via SMS (Phase 2 - Twilio).
    console.log("[DEV] OTP for", user.phone, ":", otp);
    return { message: "Reset PIN link sent to your phone (simulated)." };
  },

  //resetPin
  async resetPin(input: ResetPinInput) {
    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (!user) throw ERR.PHONE_NOT_FOUND;

    const otpHash = crypto.createHash("sha256").update(input.otp).digest("hex");
    const record = await otpPinRepo.findOtpRequest(input.phone, otpHash);

    if (!record) throw ERR.INVALID_OTP;

    const newPinHash = await argon2.hash(input.newPin, {
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    await prisma.$transaction([
      prisma.otpRequest.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { phone: input.phone },
        data: { pin: newPinHash},
      }),
      // Revoke all sessions — force re-login after PIN change
      prisma.refreshToken.updateMany({
        where: { user: { phone: input.phone } },
        data: { revoked: true },
      }),
    ]);

    return { message: "PIN reset successfully. Login to Continue" };
  },

  //registerAsSeller
  async registerAsSeller(userId: string, input: RegisterAsSellerInput) {
    const existingProfile = await prisma.sellerProfile.findUnique({
      where: { userId, street: input.street },
    });
    if (!existingProfile) throw ERR.STORE_EXISTS;

    const updatedUser = await prisma.$transaction(async (tx) => {
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

      await tx.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      })

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          roles: { push: "SELLER" },
        },
      });

      return updatedUser;
    });

    const tokens = await tokenService.issueTokens(userId, updatedUser.roles, null);
    return tokens;
  },
};
