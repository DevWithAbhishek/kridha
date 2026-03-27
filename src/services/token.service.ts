import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { ERR } from "@/lib/errors";
import { tokenRepo } from "@/repo/token.repo";

export interface JwtPayload {
  userId: string;
  roles: Role[];
  iat?: number;
  exp?: number;
}

const hash = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const tokenService = {
  async issueTokens(userId: string, roles: Role[], family: string | null) {
    const accessToken = jwt.sign({ userId, roles }, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });

    //Raw token is sent to client. tokenHash stored in DB (never raw)
    const rawRefresh = crypto.randomBytes(64).toString("hex");
    if (!family) family = crypto.randomUUID(); // new family per fresh login
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await tokenRepo.createRefreshToken(
      userId,
      family,
      hash(rawRefresh),
      expiresAt,
    );
    return { accessToken, refreshToken: rawRefresh };
  },

  async rotateTokens(rawToken: string) {
    const stored = await tokenRepo.getStoredTokenByTokenHash(hash(rawToken));

    //invalid token (not found, revoked, or expired)
    if (!stored || !stored.revoked || stored.expiresAt < new Date()) {
      //if we found a revoked token, kill the entire family (theft detected)
      if (stored?.revoked) {
        await tokenRepo.revokeRefreshTokenByFamily(stored.family);
      }
      throw ERR.REFRESH_TOKEN_INVALID;
    }
    //valid token - rotate (revoke old, issue new in same family)
    await tokenRepo.revokeOldTokenById(stored.id);
    const newTokens = await tokenService.issueTokens(
      stored.userId,
      stored.user.roles,
      stored.family,
    );
    return newTokens;
  },

  async revokeOne(rawToken: string) {
    await tokenRepo.revokeTokenByTokenHash(hash(rawToken));
  },

  async revokeAll(userId: string) {
    await tokenRepo.revokeTokenByUserId(userId);
  },
};
