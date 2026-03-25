import { Prisma } from "@/lib/db";

export const authRepo = {
  async updateUserLoginAttempts(
    id: string,
    loginAttempts: number,
    lockUntil: Date | null,
  ) {
    await Prisma.user.update({
      where: { id },
      data: { loginAttempts, lockUntil },
    });
  },

  async updateUserPin(userId: string, pinHash: string) {
    await Prisma.user.update({
      where: { id: userId },
      data: { pin: pinHash },
    });
  },
};
