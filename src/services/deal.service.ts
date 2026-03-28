import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import type { AddDealToProductInput, EditDealToProductInput } from "@/schemas";
import { Prisma } from "@prisma/client";

export const dealService = {
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
