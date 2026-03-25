import { Prisma } from "@/lib/db";

export const userRepo = {
  async findUserByPhone(phone: string) {
    return await Prisma.user.findUnique({
      where: { phone },
    });
  },

  async createUser(phone: string, pinHash: string, name: string) {
    await Prisma.user.create({
      data: {
        phone,
        pin: pinHash,
        name,
      },
    });
  },

};
