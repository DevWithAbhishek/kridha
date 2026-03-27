import { prisma } from "@/lib/db";

export const tokenRepo = {
  async createRefreshToken(
    userId: string,
    family: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        family,
        expiresAt,
      },
    });
  },

  async revokeRefreshTokenByFamily(family: string) {
    await prisma.refreshToken.updateMany({
      where: { family },
      data: { revoked: true },
    });
  },

  async revokeOldTokenById(id: string) {
    await prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  },

  async revokeTokenByTokenHash(tokenHash: string) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  },

  async revokeTokenByUserId(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  async getStoredTokenByTokenHash(tokenHash: string) {
    return await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  },
};