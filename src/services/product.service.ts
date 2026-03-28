import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { productRepo } from "@/repo/product.repo";
import type {
  AddProductInput,
  UpdateProductInput,
  GetProductsInput,
} from "@/schemas";

export const productService = {
  async listNearby(input: GetProductsInput, userId?: string) {
    return productRepo.findNearby(input, userId);
  },

  async getById(id: string) {
    const p = await productRepo.findById(id);
    if (!p) throw ERR.PRODUCT_NOT_FOUND;
    return p;
  },

  async create(sellerId: string, input: AddProductInput) {
    const { priceTiers, ...rest } = input;
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw ERR.INVALID_CREDENTIALS;
    return prisma.product.create({
      data: {
        ...rest,
        sellerId,
        city: seller.city,
        priceTiers: { create: priceTiers },
      },
      include: { priceTiers: true },
    });
  },

  async update(id: string, sellerId: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId !== sellerId) throw ERR.FORBIDDEN;
    const { priceTiers, ...rest } = input;
    return prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(priceTiers
          ? {
              priceTiers: { deleteMany: {}, create: priceTiers },
            }
          : {}),
      },
      include: { priceTiers: true },
    });
  },

  async softDelete(id: string, sellerId: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId !== sellerId) throw ERR.FORBIDDEN;
    return prisma.product.update({
      where: { id },
      data: { productStatus: "DELETED", deletedAt: new Date() },
    });
  },
};
