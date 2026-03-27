import { prisma } from "@/lib/db";

export const authRepo = {
  async updateUserLoginAttempts(
    id: string,
    loginAttempts: number,
    lockUntil: Date | null,
  ) {
    await prisma.user.update({
      where: { id },
      data: { loginAttempts, lockUntil },
    });
  },

  async updateUserPin(userId: string, pinHash: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { pin: pinHash },
    });
  },
};
