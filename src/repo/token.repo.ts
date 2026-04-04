import { prisma } from "@/lib/db";

export const tokenRepo = {
  async getStoredTokenByHash(tokenHash: string) {
    return await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, roles: true } } },
    });
  },

  async getPreferredLangForNewToken() {
    return await prisma.refreshToken.findFirst({
      where: { revoked: false },
      include: { user: { select: { preferredLang: true } } },
      orderBy: { createdAt: "desc" },
    });
  },
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

  async revokeTokenByFamily(family: string) {
    await prisma.refreshToken.updateMany({
      where: { family: family },
      data: { revoked: true },
    });
  },

  async revokeTokenByHash(tokenHash: string) {
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
};
