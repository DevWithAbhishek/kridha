import { prisma } from "@/lib/db";

export const tokenRepo = {
  async getStoredSessionByHash(tokenHash: string) {
    return await prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, roles: true } } },
    });
  },

  async getPreferredLangForNewToken() {
    return await prisma.userSession.findFirst({
      where: { revoked: false },
      include: { user: { select: { preferredLang: true } } },
      orderBy: { createdAt: "desc" },
    });
  },
  async createSession(
    userId: string,
    family: string,
    tokenHash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
    deviceInfo?: string,
    lastSeenIp?: string,
    lastSeenAt?: Date
  ) {
    await prisma.userSession.create({
      data: {
        tokenHash,
        userId,
        family,
        ipAddress: ip,
        userAgent,
        deviceInfo,
        lastSeenIp,
        lastSeenAt,
        expiresAt,
      },
    });
  },

  async revokeSessionByFamily(family: string) {
    await prisma.userSession.updateMany({
      where: { family: family },
      data: { revoked: true },
    });
  },

  async revokeSessionByHash(tokenHash: string) {
    await prisma.userSession.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  },

  async revokeSessionByUserId(userId: string) {
    await prisma.userSession.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  async updateSessionByLastSeenIp(id: string, lastSeenIp?: string, lastSeenAt?: Date) {
    await prisma.userSession.update({
      where: { id },
      data: { lastSeenIp, lastSeenAt },
    })
  }
};
