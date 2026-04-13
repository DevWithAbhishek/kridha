
// src/repo/admin.repo.ts
// All DB queries for admin operations.
// Bank details returned UNMASKED only when called from admin routes.

import { prisma } from "@/lib/db";
import { AdminRole, SellerStatus, KycStatus, Prisma } from "@prisma/client";

export const adminRepo = {

  // ── Admin user management ────────────────────────────────────────────

  async findByEmail(email: string) {
    return prisma.adminUser.findUnique({ where: { email } });
  },

  async findById(id: string) {
    return prisma.adminUser.findUnique({ where: { id } });
  },

  async create(email: string, passwordHash: string, name: string, role: AdminRole) {
    return prisma.adminUser.create({
      data: { email, passwordHash, name, role },
    });
  },

  async updateLastLogin(id: string) {
    await prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  async listAdmins() {
    return prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  },

  // ── Seller management ────────────────────────────────────────────────

  async listSellers(status?: SellerStatus, page = 1, limit = 20) {
    const where = status ? { profileStatus: status } : {};
    const [sellers, total] = await Promise.all([
      prisma.sellerProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          userId:       true,
          storeName:    true,
          city:         true,
          state:        true,
          profileStatus:true,
          kycStatus:    true,
          sellerRating: true,
          reliabilityScore: true,
          createdAt:    true,
          user: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerProfile.count({ where }),
    ]);
    return { sellers, total, page, limit, hasMore: page * limit < total };
  },

  async getSellerDetail(userId: string) {
    // Returns UNMASKED bank details — admin only
    return prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, phone: true, createdAt: true } },
      },
    });
  },

  async updateSellerStatus(
    userId:        string,
    profileStatus: SellerStatus,
    kycStatus:     KycStatus,
  ) {
    return prisma.sellerProfile.update({
      where: { userId },
      data:  { profileStatus, kycStatus },
      select: { userId: true, profileStatus: true, kycStatus: true },
    });
  },

  // ── Audit log ────────────────────────────────────────────────────────

  async logAction(
    adminId:    string,
    action:     string,
    targetType: string,
    targetId:   string,
    note?:      string,
    metadata?:  Prisma.InputJsonValue,
  ) {
    await prisma.adminAuditLog.create({
      data: { adminId, action, targetType, targetId, note, metadata },
    });
  },

  async getAuditLog(targetId?: string, adminId?: string, limit = 50) {
    return prisma.adminAuditLog.findMany({
      where: {
        ...(targetId ? { targetId } : {}),
        ...(adminId  ? { adminId  } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        admin: { select: { name: true, email: true } },
      },
    });
  },
};
