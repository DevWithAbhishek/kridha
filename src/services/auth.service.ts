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
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

async function hashByArgon(raw: string) {
  return await argon2.hash(raw);
}

const DUMMY_HASH = await hashByArgon("invalid-pin");

async function verifyByArgon(hash: string, raw: string) {
  return await argon2.verify(hash, raw);
}

function hashByCrypto(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getLockDuration(attempts: number): number | null {
  if (attempts < 5) return null;
  if (attempts < 10) return 10 * 60_000; // 10 minutes
  if (attempts < 20) return 60 * 60_000; // 1 hour
  return 24 * 3_600_000;
}

export const authService = {
  async signup(input: SignupInput): Promise<void> {
    // Silent — same 201 whether phone exists or not (INV-07 / enumeration prevention)
    const existing = await authRepo.findUserByPhone(input.phone);
    if (existing) {
      logger.warn(
        {
          event: "auth.signup_duplicate",
          phoneTail: input.phone.slice(-4),
        },
        "signup attempted on existing phone",
      );
      return;
    }
    const pin = await hashByArgon(input.pin);
    await authRepo.createUser(input.phone, pin, input.name);
    logger.info(
      {
        event: "auth.signup",
        phoneTail: input.phone.slice(-4),
      },
      "user signed up",
    );
  },

  async login(input: LoginInput, ip?: string, ua?: string) {
    const user = await authRepo.findUserByPhone(input.phone);

    // Prevention from timing attacks
    const hash = user?.pinHash ?? DUMMY_HASH;
    const valid = await verifyByArgon(hash, input.pin);

    if (!user || !valid) {
      const attempts = (user?.pinAttempts ?? 0) + 1;
      logger.warn(
        {
          event: "auth.login_failed",
          phoneTail: input.phone.slice(-4),
          ip,
          attempts,
        },
        "login failed",
      );

      // Alert GlitchTip on high attempt count - possible credential stuffing
      if (attempts >= 10) {
        Sentry.captureMessage(
          `High login failures: ${attempts} attempts on ${input.phone.slice(-4)} from ${ip}`,
          "warning",
        );
      }

      if (user) {
        const lockedUntil = getLockDuration(attempts)
          ? new Date(Date.now() + getLockDuration(attempts)!)
          : null;
        await authRepo.updateUserLoginAttempts(user.id, attempts, lockedUntil);
      }

      throw ERR.INVALID_CREDENTIALS;
    }

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      logger.warn(
        {
          event: "auth.pin_locked",
          userId: user.id,
          ip,
        },
        "login attempted on locked account",
      );
      throw ERR.PIN_LOCKED;
    }

    await authRepo.updateUserLoginAttempts(user.id, 0, null);
    const tokens = await tokenService.issueTokens(user.id, user.roles, ip, ua);

    logger.info(
      {
        event: "auth.login_success",
        userId: user.id,
        roles: user.roles,
        ip,
      },
      "login successful",
    );

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
    logger.info(
      { event: "auth.otp_generated", phoneTail: input.phone.slice(-4) },
      process.env.NODE_ENV !== "production"
        ? `[DEV OTP] ${otp}` // visible in dev terminal
        : "OTP generated", // production: no OTP in logs
    );
  },

  async resetPin(input: ResetPinInput): Promise<void> {
    const otpHash = hashByCrypto(input.otp);
    const record = await authRepo.findOtpRequest(input.phone, otpHash);
    if (!record) {
      logger.warn(
        { event: "auth.otp_invalid", phoneTail: input.phone.slice(-4) },
        "invalid OTP attempt",
      );
      throw ERR.INVALID_OTP;
    }
    const newPin = await hashByArgon(input.newPin);
    await authRepo.resetPin(record.id, input.phone, newPin);
    logger.info(
      { event: "auth.pin_reset", phoneTail: input.phone.slice(-4) },
      "PIN reset successful — all sessions revoked",
    );
  },

  async registerAsSeller(userId: string, input: RegisterAsSellerInput) {
    const conflict = await authRepo.findSeller(input.storeName, input.street);
    if (conflict) throw ERR.STORE_EXISTS;

    await authRepo.createSeller(input, userId);
    // Create default pickup windows after transaction
    await pickupWindowService.createDefaults(userId);

    logger.info(
      {
        event: "auth.seller_registered",
        userId,
        storeName: input.storeName,
      },
      "seller profile creation - pending verification",
    );

    return {
      success: true,
      data: { status: "PENDING", bankVerified: false },
    };
  },

  async getUpdatedUser(userId: string) {
    return authRepo.findUpdatedUser(userId);
  },
};
