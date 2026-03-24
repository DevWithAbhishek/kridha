import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { ERR } from "@/lib/errors";

export interface JwtPayload {
  userId: string;
  roles: Role[];
  iat?: number;
  exp?: number;
}

export const tokenService = {
  async issueTokens(userId: string, roles: Role[], family: string | null) {
    const accessToken = jwt.sign({ userId, roles }, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });

    //Raw token is sent to client. tokenHash stored in DB (never raw)
    const rawRefresh = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(rawRefresh)
      .digest("hex");
    if (!family) family = crypto.randomUUID(); // new family per fresh login
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId,
        family,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  },

  async rotateTokens(rawToken: string) {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const stored = await Prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });

    //invalid token (not found, revoked, or expired)
    if (!stored || !stored.revoked || stored.expiresAt < new Date()) {
      //if we found a revoked token, kill the entire family (theft detected)
      if (stored) {
        await Prisma.refreshToken.updateMany({
          where: { family: stored.family },
          data: { revoked: true },
        });
      }

      throw ERR.REFRESH_TOKEN_INVALID;
    }

    //valid token - rotate (revoke old, issue new in same family)
    await Prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const newTokens = await tokenService.issueTokens(
      stored.userId,
      stored.user.roles,
      stored.family,
    );

    return newTokens;
  },

  async revokeOne(rawToken: string) {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await Prisma.refreshToken.updateMany({
      where: { tokenHash: hash },
      data: { revoked: true },
    });
  },

  async revokeAll(userId: string) {
    await Prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },
};
