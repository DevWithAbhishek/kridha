import { Prisma } from "@/lib/db";

export const otpPinRepo = {
  async createResetOtpRequest(phone: string, otpHash: string, expiresAt: Date) {
    await Prisma.otpRequest.create({
      data: {
        phone,
        otpHash,
        expiresAt,
      },
    });
  },

  async findOtpRequest(phone: string, otpHash: string) {
    return await Prisma.otpRequest.findFirst({
      where: { phone, otpHash, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateOtpRequestUsed(id: string) {
    await Prisma.otpRequest.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },
};