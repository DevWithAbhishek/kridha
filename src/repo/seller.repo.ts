import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
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
  },
    
  async updateKycOrBank(userId: string, body: EditSellerProfileInput) {
    return await prisma.sellerProfile.update({
      where: { userId },
      data: {
        ...body,
        kycStatus: "PENDING",
        profileStatus: 'PENDING',
        bankVerified: false
      }
      })
  },
  
  async checkValidEdit(userId: string) {
    const seller = await prisma.sellerProfile.findUnique({
      where: {userId}
    })
    if (!seller) throw ERR.FORBIDDEN;
    const [orders, payouts] = await Promise.all([
      await prisma.subOrder.findFirst({
        where: {
          sellerId: seller.id,
          status: {
            notIn: [
              "CANCELLED",
              "COMPLETED",
              "DISPUTED"
            ]
          }
        }
      }),
      await prisma.payout.findFirst({
        where: {
          sellerId: seller.id,
          status: {
            in: [
              "PENDING",
              "PROCESSING"
            ]
          }
        }
      })
    ]);

    if (orders || payouts) return false;
    return true;
  }
};
