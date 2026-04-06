// No-show penalty + seller cancellation penalty.
// Called from cron expire-orders and order cancel.
// ─────────────────────────────────────────────────────────────────────────────

import { userRepo } from "@/repo/user.repo";
import {
  EditUserAvatarInput,
  EditUserProfileInput,
} from "@/schemas";

export const userService = {

  async getUserById(userId: string) {
    return await userRepo.findUser(userId);
  },

  async updateUser(userId: string, body: EditUserProfileInput) {
    return await userRepo.updateUserProfile(userId, body);
  },

  async getActiveOrders(userId: string) {
    return await userRepo.findActiveOrder(userId);
  },

  async deleteUser(userId: string) {
    await userRepo.softDeleteUser(userId);
  },

  async getAvatar(userId: string) {
    return await userRepo.findUserAvatar(userId);
  },

  async updateAvatar(userId: string, avatar: EditUserAvatarInput) {
    await userRepo.updateUserAvatar(userId, avatar);
  },

  async deleteAvatar(userId: string) {
    await userRepo.deleteAvatar(userId);
  },
};
