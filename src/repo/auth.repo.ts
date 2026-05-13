import { prisma } from "@/lib/db";
import { RegisterAsSellerInput } from "@/schemas";

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
        pinHash,
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

  async resetPin(id: string, phone: string, newPin: string) {
    await prisma.$transaction([
      prisma.otpRequest.update({
        where: { id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { phone },
        data: { pin: newPin },
      }),
      // Revoke all sessions — force re-login after PIN change
      prisma.refreshToken.updateMany({
        where: { user: { phone } },
        data: { revoked: true },
      }),
    ]);
  },

  async createSeller(input: RegisterAsSellerInput, userId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.sellerProfile.create({
        data: {
          userId,
          storeName: input.storeName,
          street: input.street,
          line2: input.line2 ?? null,
          landmark: input.landmark ?? null,
          city: input.city,
          state: input.state,
          pinCode: input.pincode,
          businessType: input.businessType as never,
          gstNumber: input.gstNo ?? null,
          panNumber: input.panNo,
          accountHolderName: input.accountHolderName,
          accountNumber: input.accountNumber,
          ifscCode: input.ifscCode,
          bankName: input.bankName,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { roles: { push: "SELLER" } },
      });
    });
  },
};
