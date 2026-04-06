import { prisma } from "@/lib/db";
import { EditSellerProfileInput } from "@/schemas";

export const sellerRepo = {
  async getSellerProfile(userId: string) {
    return await prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        pickupWindows: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    },
    
    async findSellerProfile(userId: string) {
        return await prisma.sellerProfile.findUnique({
          where: { userId},
        });
    },

    async checkConflict(userId: string, newStoreName: string, newStreet: string) {
        return await prisma.sellerProfile.findFirst({
          where: {
            storeName: newStoreName,
            street: newStreet,
            NOT: { userId},
          },
        });
    }, 

    async updateSeller(userId: string, body: EditSellerProfileInput) {
        return await prisma.sellerProfile.update({
          where: { userId },
          data: body,
        });
    },

    async findSellerStoreImages(userId: string) {
        return await prisma.sellerProfile.findUnique({
          where: { userId},
          select: { storeImages: true },
        });
    }
};
