// JWT access (15m) + sha256-hashed refresh tokens (7d).
// Token family theft detection: reusing a rotated token revokes entire family.
// sha256 not argon2 for refresh tokens — they are 256-bit random, not passwords.
// ─────────────────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { ERR } from "@/lib/errors";

interface JwtPayload {
  userId: string;
  roles: Role[];
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const tokenService = {
  async issueTokens(userId: string, roles: Role[]) {
    const accessToken = jwt.sign(
      { userId, roles } satisfies JwtPayload,
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );

    const raw = crypto.randomBytes(64).toString("hex");
    const family = crypto.randomUUID();

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        family,
        expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        revoked: false,
      },
    });

    return { accessToken, refreshToken: raw };
  },

  async rotate(raw: string) {
    const hash = hashToken(raw);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { select: { id: true, roles: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw ERR.REFRESH_TOKEN_INVALID;
    }

    if (stored.revoked) {
      // Theft detected — revoke entire family
      await prisma.refreshToken.updateMany({
        where: { family: stored.family },
        data: { revoked: true },
      });
      throw ERR.REFRESH_TOKEN_INVALID;
    }

    // Revoke used token, issue new one in same family
    await prisma.refreshToken.update({
      where: { tokenHash: hash },
      data: { revoked: true },
    });

    const newRaw = crypto.randomBytes(64).toString("hex");
    await prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: hashToken(newRaw),
        family: stored.family, // same family — rotation chain
        expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        revoked: false,
      },
    });

    const accessToken = jwt.sign(
      { userId: stored.userId, roles: stored.user.roles } satisfies JwtPayload,
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );

    return { accessToken, refreshToken: newRaw };
  },

  async revokeOne(raw: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw) },
      data: { revoked: true },
    });
  },

  async revokeAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },
};
