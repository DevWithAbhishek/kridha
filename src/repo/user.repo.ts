import { prisma } from "@/lib/db";

export const userRepo = {
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

};
