import { prisma } from "@/lib/db";

export const otpPinRepo = {
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