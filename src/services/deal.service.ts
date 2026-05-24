import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import {
  AddDealToProductInput,
  EditDealToProductInput,
  GetProductsInput,
  GetSellerDealsInput,
} from "@/schemas";
import { withCache, cacheInvalidate, CK, TTL } from "@/lib/redis";
import { productRepo } from "@/repo/product.repo";
import { cache } from "react";

export const dealService = {
  async add(productId: string, sellerId: string, input: AddDealToProductInput) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId != sellerId) throw ERR.FORBIDDEN;

    // Only one ACTIVE deal per product (service-layer guard)
    const existing = await prisma.deal.findFirst({
      where: { productId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (existing) throw ERR.DEAL_EXISTS;

    if (input.expiresAt <= new Date()) throw ERR.INVALID_EXPIRY_TIME;

    const deal = await prisma.deal.create({
      data: {
        productId,
        sellerId,
        discountPercent: input.discountPercent,
        expiresAt: input.expiresAt,
        status: "ACTIVE",
      },
    });

    // Invalidate product detail (shows deal price) + deals list + product list
    await cacheInvalidate.deals();
    await cacheInvalidate.product(productId, sellerId);
    return deal;
  },

  async edit(
    productId: string,
    sellerId: string,
    input: EditDealToProductInput,
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId != sellerId) throw ERR.FORBIDDEN;

    // Only one ACTIVE deal per product (service-layer guard)
    const deal = await prisma.deal.findFirst({
      where: { productId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (!deal) throw ERR.NO_ACTIVE_DEAL;

    if (input.expiresAt && input.expiresAt <= new Date())
      throw ERR.INVALID_EXPIRY_TIME;

    return prisma.deal.update({
      where: { id: deal.id },
      data: {
        ...(input.discountPercent !== undefined
          ? { discountPercent: input.discountPercent }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt }
          : {}),
      }, //Conditionally updates only the fields provided (discountPercent, expiresAt) in a partial update.
    });
  },

  async remove(productId: string, sellerId: string) {
    const deal = await prisma.deal.findFirst({
      where: { productId, status: "ACTIVE" },
    });
    if (!deal) throw ERR.NO_ACTIVE_DEAL;
    if (deal.sellerId != sellerId) throw ERR.FORBIDDEN;

    return prisma.deal.update({
      where: { id: deal.id },
      data: { status: "EXPIRED" },
    });
  },

  async listMine(sellerId: string, input: GetSellerDealsInput) {
    const safePage = Math.max(1, input.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, input.limit ?? 20));

    // Enables flexible query composition by conditionally injecting filters into Prisma where without branching query logic.
    const statusFilter =
      input.status === "active"
        ? { status: "ACTIVE" as const }
        : input.status === "expired"
          ? { status: "EXPIRED" as const }
          : {};

    // Executes a paginated, relation-loaded query that joins deals with products and tiers, optimizing data fetching with a single DB call.
    return prisma.deal.findMany({
      where: { sellerId, ...statusFilter },
      include: {
        product: {
          include: { priceTiers: true },
        },
      },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      orderBy: { createdAt: "desc" },
    });
  },

  // Called from GET /api/products/deals — all products with an active deal
  async listActiveDealsNearby(lat: number, lng: number, radius: number) {
    // Reuses productRepo.findNearBy with deal active filter and caching — ensures consistent results and efficient DB usage.
    const cacheKey = CK.dealsList(lat, lng, radius);
    return withCache(cacheKey, TTL.DEALS_LIST, () =>
      productRepo.findNearby(
        {
          lat,
          lng,
          radius,
          dealActive: true,
          limit: 50,
          page: 1,
        } as GetProductsInput,
        undefined,
      ),
    );
  },
};
