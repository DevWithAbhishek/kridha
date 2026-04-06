import { prisma } from "@/lib/db";
import { EditUserAvatarInput, EditUserProfileInput } from "@/schemas";

export const userRepo = {
  async findUser(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        street: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        profileImageUrl: true,
        preferredLang: true,
        roles: true,
        reliabilityScore: true,
        noShowCount: true,
        creditBalance: true,
        isFlagged: true,
        createdAt: true,
      },
    });
  },

  async updateUserProfile(id: string, body: EditUserProfileInput) {
    return await prisma.user.update({
      where: { id: id },
      data: body,
      select: {
        id: true,
        name: true,
        street: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        preferredLang: true,
        updatedAt: true,
      },
    });
  },

  async findActiveOrder(userId: string) {
    return await prisma.subOrder.findFirst({
      where: {
        order: { buyerId: userId },
        status: { notIn: ["COMPLETED", "CANCELLED", "DISPUTED"] },
      },
    });
  },

  async softDeleteUser(id: string) {
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async findUserAvatar(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      select: { profileImagePublicId: true },
    });
  },

  async updateUserAvatar(id: string, avatar: EditUserAvatarInput) {
    await prisma.user.update({
      where: { id },
      data: {
        profileImageUrl: avatar.profileImageUrl,
        profileImagePublicId: avatar.profileImagePublicId,
      },
      select: { id: true, profileImageUrl: true },
    });
  },

  async deleteAvatar(id: string) {
    await prisma.user.update({
      where: { id },
      data: { profileImageUrl: null, profileImagePublicId: null },
    });
  },
};
