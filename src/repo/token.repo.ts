import { Prisma } from "@/lib/db";

export const tokenRepo = {
  async createRefreshToken(
    userId: string,
    family: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await Prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        family,
        expiresAt,
      },
    });
  },

  async revokeRefreshTokenByFamily(family: string) {
    await Prisma.refreshToken.updateMany({
      where: { family },
      data: { revoked: true },
    });
  },

  async revokeOldTokenById(id: string) {
    await Prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  },

  async revokeTokenByTokenHash(tokenHash: string) {
    await Prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  },

  async revokeTokenByUserId(userId: string) {
    await Prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  async getStoredTokenByTokenHash(tokenHash: string) {
    return await Prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  },
};