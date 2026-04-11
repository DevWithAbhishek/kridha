import argon2 from "argon2";
import crypto from "crypto";
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
import { authRepo } from "@/repo/auth.repo";

async function hashByArgon(raw: string) {
  return await argon2.hash(raw);
}

async function verifyByArgon(hash: string, raw: string) {
  return await argon2.verify(hash, raw);
}

function hashByCrypto(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const authService = {
  async signup(input: SignupInput): Promise<void> {
    // Silent — same 201 whether phone exists or not (INV-07 / enumeration prevention)
    const existing = await authRepo.findUserByPhone(input.phone);
    if (existing) return;
    const pin = await hashByArgon(input.pin);
    await authRepo.createUser(input.phone, pin, input.name);
  },

  async login(input: LoginInput) {
    const user = await authRepo.findUserByPhone(input.phone);
    // Same error for wrong phone and wrong PIN — prevents enumeration
    if (!user || !user.pin) throw ERR.INVALID_CREDENTIALS;
    if (user.pinLockedUntil && user.pinLockedUntil > new Date())
      throw ERR.PIN_LOCKED;

    const valid = await verifyByArgon(user.pin, input.pin);
    if (!valid) {
      const attempts = user.pinAttempts + 1;
      const lockUntil =
        attempts >= 5 ? new Date(Date.now() + 10 * 60_000) : null;
      await authRepo.updateUserLoginAttempts(user.id, attempts, lockUntil);
      throw ERR.INVALID_CREDENTIALS;
    }
    await authRepo.updateUserLoginAttempts(user.id, 0, null);
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
    const user = await authRepo.findUserByPhone(input.phone);
    if (!user) throw ERR.PHONE_NOT_FOUND;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = hashByCrypto(otp);
    await authRepo.createResetOtpRequest(
      user.phone,
      otpHash,
      new Date(Date.now() + 10 * 60_000),
    );

    // Phase 2: send via Twilio. Dev: log to console.
    console.log(`[DEV OTP] phone=${input.phone} otp=${otp}`);
  },

  async resetPin(input: ResetPinInput): Promise<void> {
    const otpHash = hashByCrypto(input.otp);
    const record = await authRepo.findOtpRequest(input.phone, otpHash);
    if (!record) throw ERR.INVALID_OTP;
    const newPin = await hashByArgon(input.newPin);
    await authRepo.resetPin(record.id, input.phone, newPin);
  },

  async registerAsSeller(userId: string, input: RegisterAsSellerInput) {
    const conflict = await authRepo.findSeller(input.storeName, input.street);
    if (conflict) throw ERR.STORE_EXISTS;

    await authRepo.createSeller(input, userId);
    // Create default pickup windows after transaction
    await pickupWindowService.createDefaults(userId);
    return {
      success: true,
      data: { status: "PENDING", bankVerified: false },
    }
  },

  async getUpdatedUser(userId: string) {
    return authRepo.findUpdatedUser(userId);
  },
};
