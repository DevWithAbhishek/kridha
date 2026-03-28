import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import type { AddDealToProductInput, EditDealToProductInput } from "@/schemas";
import { Prisma } from "@prisma/client";

export const dealService = {
  // Creates a new active deal for a product after validating ownership and ensuring no existing active deal. Checks product exists → verifies sellerId ownership → checks no ACTIVE deal exists → then create inserts new deal with discount and expiry.
  async add(productId: string, sellerId: string, input: AddDealToProductInput) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId !== sellerId) throw ERR.FORBIDDEN;
    const existing = await prisma.deal.findFirst({
      where: { productId, status: "ACTIVE" },
    });
    if (existing) throw ERR.DEAL_EXISTS;
    return prisma.deal.create({
      data: {
        productId,
        sellerId,
        discountPercent: input.discountPercent,
        expiresAt: input.expiresAt,
        status: "ACTIVE",
      },
    });
  },

  // Updates an existing active deal for a product with new discount and expiry. findFirst ensures an ACTIVE deal exists for given productId + sellerId → if not, throws error → else update modifies discountPercent and expiresAt.
  async edit(
    productId: string,
    sellerId: string,
    input: EditDealToProductInput,
  ) {
    const deal = await prisma.deal.findFirst({
      where: { productId, sellerId, status: "ACTIVE" },
    });
    if (!deal) throw ERR.NO_ACTIVE_DEAL;
    return prisma.deal.update({
      where: { id: deal.id },
      data: {
        discountPercent: input.discountPercent,
        expiresAt: input.expiresAt,
      },
    });
  },

  // Finds an active deal for a product and marks it as expired (soft remove). findFirst checks for an ACTIVE deal → if none, throws error → else update sets status = "EXPIRED" for that deal.
  async remove(productId: string, sellerId: string) {
    const deal = await prisma.deal.findFirst({
      where: { productId, sellerId, status: "ACTIVE" },
    });
    if (!deal) throw ERR.NO_ACTIVE_DEAL;
    return prisma.deal.update({
      where: { id: deal.id },
      data: { status: "EXPIRED" },
    });
  },

  // Fetches a paginated list of deals for a seller, optionally filtered by status, including product + its price tiers. Builds dynamic where → "all" = no status filter, else maps to ACTIVE/EXPIRED → findMany with include (product + tiers) → applies skip/take pagination and createdAt DESC sorting.
  async listMine(
    sellerId: string,
    status: string,
    page: number,
    limit: number,
  ) {
    const where: Prisma.DealWhereInput =
      status === "all"
        ? { sellerId }
        : { sellerId, status: status === "active" ? "ACTIVE" : "EXPIRED" };

    return prisma.deal.findMany({
      where,
      include: { product: { include: { priceTiers: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  },
};
