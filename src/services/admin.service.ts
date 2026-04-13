
// src/services/admin.service.ts
// Business logic for all admin operations.
// Token signing, seller status transitions, audit logging all here.

import { AdminRole, KycStatus, SellerStatus } from "@prisma/client";
import { adminRepo } from "@/repo/admin.repo";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/adminPassword";
import { signAdminToken } from "@/lib/adminJwt";
import { ERR } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { AdminLoginInput, AdminCreateInput, AdminVerifySellerInput } from "@/schemas/admin.schemas";

export const adminService = {

  // ── Auth ─────────────────────────────────────────────────────────────

  async login(input: AdminLoginInput, ip: string) {
    const admin = await adminRepo.findByEmail(input.email);
    // Same message for wrong email and wrong password — prevents enumeration
    console.log(input.email);
    console.log(input.email.trim());
    console.log("admin: ", admin);
    if (!admin) throw ERR.ADMIN_INVALID_CREDENTIALS;

    const valid = await verifyAdminPassword(input.password, admin.passwordHash);
    console.log("valid: ", valid);
    if (!valid) {
      logger.warn({ email: input.email, ip, action: "admin.login.fail" }, "Admin login failed");
      throw ERR.ADMIN_INVALID_CREDENTIALS;
    }

    await adminRepo.updateLastLogin(admin.id);
    const token = signAdminToken(admin.id, admin.role);
    console.log("token: ", token);

    logger.info({ adminId: admin.id, ip, action: "admin.login.success" }, "Admin logged in");
    return { token, admin: { id: admin.id, name: admin.name, role: admin.role } };
  },

  // ── Seller management ────────────────────────────────────────────────

  async listSellers(status?: string, page?: number) {
    const s = status as SellerStatus | undefined;
    return adminRepo.listSellers(s, page);
  },

  async getSellerDetail(userId: string) {
    const seller = await adminRepo.getSellerDetail(userId);
    if (!seller) throw ERR.SELLER_NOT_FOUND;
    return seller;
  },

  async verifySeller(
    adminId:    string,
    userId:     string,
    input:      AdminVerifySellerInput,
  ) {
    const seller = await adminRepo.getSellerDetail(userId);
    if (!seller) throw ERR.SELLER_NOT_FOUND;
    if (seller.profileStatus === SellerStatus.VERIFIED) throw ERR.SELLER_ALREADY_VERIFIED;

    // Snapshot previous state for audit trail
    const prev = { profileStatus: seller.profileStatus, kycStatus: seller.kycStatus };

    const updated = await adminRepo.updateSellerStatus(
      userId,
      SellerStatus.VERIFIED,
      KycStatus.VERIFIED,
    );

    await adminRepo.logAction(
      adminId,
      "VERIFY_SELLER",
      "SellerProfile",
      userId,
      input.note,
      { previous: prev },
    );

    logger.info({ adminId, sellerId: userId, action: "admin.verify_seller" }, "Seller verified");
    return updated;
  },

  async rejectSeller(adminId: string, userId: string, input: AdminVerifySellerInput) {
    const seller = await adminRepo.getSellerDetail(userId);
    if (!seller) throw ERR.SELLER_NOT_FOUND;

    const prev = { profileStatus: seller.profileStatus, kycStatus: seller.kycStatus };

    const updated = await adminRepo.updateSellerStatus(
      userId,
      SellerStatus.DEACTIVATED,
      KycStatus.REJECTED,
    );

    await adminRepo.logAction(
      adminId,
      "REJECT_SELLER",
      "SellerProfile",
      userId,
      input.note,
      { previous: prev },
    );

    logger.warn({ adminId, sellerId: userId, reason: input.note }, "Seller rejected");
    return updated;
  },

  async suspendSeller(adminId: string, userId: string, note?: string) {
    const seller = await adminRepo.getSellerDetail(userId);
    if (!seller) throw ERR.SELLER_NOT_FOUND;

    const updated = await adminRepo.updateSellerStatus(
      userId,
      SellerStatus.DEACTIVATED,
      seller.kycStatus,
    );

    await adminRepo.logAction(adminId, "SUSPEND_SELLER", "SellerProfile", userId, note, {
      previous: { profileStatus: seller.profileStatus },
    });

    logger.warn({ adminId, sellerId: userId }, "Seller suspended");
    return updated;
  },

  // ── Admin user management (SUPER_ADMIN only) ─────────────────────────

  async createAdmin(
    creatorId: string,
    input:     AdminCreateInput,
  ) {
    const passwordHash = await hashAdminPassword(input.password);
    const admin = await adminRepo.create(
      input.email.toLowerCase().trim(),
      passwordHash,
      input.name,
      input.role as AdminRole,
    );

    await adminRepo.logAction(
      creatorId,
      "CREATE_ADMIN",
      "AdminUser",
      admin.id,
      `Created ${admin.role} account for ${admin.email}`,
    );

    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  },

  async listAdmins() {
    return adminRepo.listAdmins();
  },

  // ── Audit ────────────────────────────────────────────────────────────

  async getAuditLog(targetId?: string, adminId?: string) {
    return adminRepo.getAuditLog(targetId, adminId);
  },
};
