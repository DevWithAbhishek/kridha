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
    const { priceTiers, ...rest } = input; // Extracts priceTiers from input and keeps the remaining fields in rest.
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw ERR.INVALID_CREDENTIALS;
    // Creates a new product with its price tiers and returns it with tiers included. Spreads main fields (rest) → adds sellerId + city → nested write priceTiers.create inserts related rows in same query → include fetches created tiers.
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
    // Updates a product and optionally replaces all its price tiers. Spreads rest → if priceTiers exists, Prisma performs nested write: deleteMany (removes all old tiers) + create (inserts new ones) → returns updated product with tiers.
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
    // Marks a product as soft-deleted instead of removing it from the database.
    return prisma.product.update({
      where: { id },
      data: { productStatus: "DELETED", deletedAt: new Date() },
    });
  },
};
