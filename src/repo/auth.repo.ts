import { prisma } from "@/lib/db";

export const authRepo = {
  async updateUserLoginAttempts(
    id: string,
    pinAttempts: number,
    pinLockedUntil: Date | null,
  ) {
    await prisma.user.update({
      where: { id },
      data: { pinAttempts, pinLockedUntil },
    });
  },

  async updateUserPin(userId: string, pinHash: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { pin: pinHash },
    });
  },

  async findSeller(storeName: string, street: string) {
    return await prisma.sellerProfile.findFirst({
      where: { storeName: storeName, street: street },
    });
  },

  async findUserByPhone(phone: string) {
    return await prisma.user.findUnique({
      where: { phone },
    });
  },

  async findUpdatedUser(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true, preferredLang: true },
    });
  },

  async createUser(phone: string, pinHash: string, name: string) {
    await prisma.user.create({
      data: {
        phone,
        pin: pinHash,
        name,
      },
    });
  },

  async createResetOtpRequest(phone: string, otpHash: string, expiresAt: Date) {
    await prisma.otpRequest.create({
      data: {
        phone,
        otpHash,
        expiresAt,
      },
    });
  },

  async findOtpRequest(phone: string, otpHash: string) {
    return prisma.otpRequest.findFirst({
      where: {
        phone: phone,
        otpHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateOtpRequestUsed(id: string) {
    await prisma.otpRequest.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },
};
