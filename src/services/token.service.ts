// JWT access (15m) + sha256-hashed refresh tokens (7d).
// Token family theft detection: reusing a rotated token revokes entire family.
// sha256 not argon2 for refresh tokens — they are 256-bit random, not passwords.
// ─────────────────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { ERR } from "@/lib/errors";
import { tokenRepo } from "@/repo/token.repo";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs"

interface JwtPayload {
  userId: string;
  roles: Role[];
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function createJwtToken(userId: string, roles: Role[]) {
  return jwt.sign(
    { userId, roles } satisfies JwtPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  );
}

function parseUserAgent(ua: string): string {
  if (ua.includes("Chrome")) return "Chrome Browser";
  if (ua.includes("Firefox")) return "FireFox Browser";
  if (ua.includes("Safari")) return "Safari Browser";
  if (ua.includes("Edge")) return "Edge Browser";
  if (ua.includes("Brave")) return "Brave Browser";
  if (ua.includes("Mobile")) return "Mobile Browser";
  return "Unknown Device";
}

export const tokenService = {
  async issueTokens(
    userId: string,
    roles: Role[],
    ip?: string,
    userAgent?: string,
  ) {
    const accessToken = createJwtToken(userId, roles);
    const raw = crypto.randomBytes(64).toString("hex");
    const family = crypto.randomUUID();

    await tokenRepo.createSession(
      userId,
      family,
      hashToken(raw),
      new Date(Date.now() + 7 * 24 * 3_600_000),
      ip,
      userAgent,
      parseUserAgent(userAgent ?? ""),
      ip, // lastSeenIp addresss
      new Date(),
    );
    return { accessToken, refreshToken: raw };
  },

  async rotateTokens(raw: string, ip?: string) {
    const hash = hashToken(raw);
    const existing = await tokenRepo.getStoredSessionByHash(hash);
    if (!existing || existing.revoked || existing.expiresAt < new Date()) {
      if (existing) {
        await tokenRepo.revokeSessionByUserId(existing.userId);
        logger.error(
          {
            event: "security.token_theft",
            userId: existing.userId,
            ip,
          },
          "CRITICAL: refresh token reuse - all sessions revoked",
        );
        Sentry.captureMessage(
          `Token theft detected: userId=${existing.userId}`,
          "fatal"
        );
      }
      throw ERR.REFRESH_TOKEN_INVALID;
    }

    if (ip && existing.lastSeenIp && existing.lastSeenIp !== ip) {
      logger.warn({
        event: "security.ip_change_on_refresh",
        userId: existing.userId,
        originalIp: existing.lastSeenIp,
        newIp: ip
      }, "IP changed on token refresh - possible session hijack");
    }

    await tokenRepo.updateSessionByLastSeenIp(existing.id, ip, new Date());

    // Revoke used token, issue new one in same family
    await tokenRepo.revokeSessionByHash(hash);

    const newRaw = crypto.randomBytes(64).toString("hex");
    await tokenRepo.createSession(
      existing.userId,
      existing.family,
      hashToken(newRaw),
      new Date(Date.now() + 7 * 24 * 3_600_000),
    );
    const accessToken = createJwtToken(existing.userId, existing.user.roles);

    const storedLang = await tokenRepo.getPreferredLangForNewToken();
    const lang = storedLang?.user?.preferredLang ?? "hi";

    return { accessToken, refreshToken: newRaw, lang };
  },

  async revokeOne(raw: string): Promise<void> {
    await tokenRepo.revokeSessionByHash(hashToken(raw));
  },

  async revokeAll(userId: string): Promise<void> {
    await tokenRepo.revokeSessionByUserId(userId);
  },
};
