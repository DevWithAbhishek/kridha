import { sellerRepo } from "@/repo/seller.repo";
import { EditSellerProfileInput } from "@/schemas";
import { use } from "react";

export const sellerService = {
  async getSellerProfile(userId: string) {
    return await sellerRepo.getSellerProfile(userId);
  },

  async findSeller(userId: string) {
    return await sellerRepo.findSellerProfile(userId);
  },

  async checkConflict(userId: string, newStoreName: string, newStreet: string) {
    return await sellerRepo.checkConflict(userId, newStoreName, newStreet);
  },

  async checkValidChange(userId: string) {
    return sellerRepo.checkValidEdit(userId);
  },

  async updateSellerCriticalDetails(
    userId: string,
    body: EditSellerProfileInput,
  ) {
    return sellerRepo.updateKycOrBank(userId, body);
  },

  async updateSellerProfile(userId: string, body: EditSellerProfileInput) {
    return await sellerRepo.updateSeller(userId, body);
  },

  async getSellerStoreImages(userId: string) {
    return await sellerRepo.findSellerStoreImages(userId);
  },
};
