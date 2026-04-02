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

  async findUserByPhone(phone: string) {
    return await prisma.user.findUnique({
      where: { phone },
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
    return await prisma.otpRequest.findFirst({
      where: { phone, otpHash, expiresAt: { gt: new Date() } },
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
