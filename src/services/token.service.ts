// JWT access (15m) + sha256-hashed refresh tokens (7d).
// Token family theft detection: reusing a rotated token revokes entire family.
// sha256 not argon2 for refresh tokens — they are 256-bit random, not passwords.
// ─────────────────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { ERR } from "@/lib/errors";
import { tokenRepo } from "@/repo/token.repo";

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

export const tokenService = {
  async issueTokens(userId: string, roles: Role[]) {
    const accessToken = createJwtToken(userId, roles);
    const raw = crypto.randomBytes(64).toString("hex");
    const family = crypto.randomUUID();

    await tokenRepo.createRefreshToken(
      userId,
      family,
      hashToken(raw),
      new Date(Date.now() + 7 * 24 * 3_600_000),
    );
    return { accessToken, refreshToken: raw };
  },

  async rotate(raw: string) {
    const hash = hashToken(raw);
    const stored = await tokenRepo.getStoredTokenByHash(hash);
    if (!stored || stored.expiresAt < new Date()) {
      throw ERR.REFRESH_TOKEN_INVALID;
    }
    if (stored.revoked) {
      // Theft detected — revoke entire family
      await tokenRepo.revokeTokenByFamily(stored.family);
      throw ERR.REFRESH_TOKEN_INVALID;
    }

    // Revoke used token, issue new one in same family
    await tokenRepo.revokeTokenByHash(hash);

    const newRaw = crypto.randomBytes(64).toString("hex");
    await tokenRepo.createRefreshToken(
      stored.userId,
      stored.family,
      hashToken(newRaw),
      new Date(Date.now() + 7 * 24 * 3_600_000),
    );
    const accessToken = createJwtToken(stored.userId, stored.user.roles);

    const storedLang = await tokenRepo.getPreferredLangForNewToken();
    const lang = storedLang?.user?.preferredLang ?? "hi";
    
    return { accessToken, refreshToken: newRaw , lang };
  },

  async revokeOne(raw: string): Promise<void> {
    await tokenRepo.revokeTokenByHash(hashToken(raw));
  },

  async revokeAll(userId: string): Promise<void> {
    await tokenRepo.revokeTokenByUserId(userId);
  },
};
