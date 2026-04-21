import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { productRepo } from "@/repo/product.repo";
import type {
  AddProductInput,
  GetProductsInput,
  UpdateProductInput,
  GetSellerProductsInput,
} from "@/schemas";

export const productService = {
  async listNearBy(input: GetProductsInput, userId?: string) {
    return productRepo.findNearby(input, userId);
  },

  async getById(id: string) {
    const product = await productRepo.findById(id);
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    return product;
  },

  async getSellerProducts(sellerId: string, input: GetSellerProductsInput) {
    return productRepo.findBySeller(sellerId, input);
  },

  async getSellerProductById(productId: string, sellerId: string) {
    const product = await productRepo.findBySellerAndId(productId, sellerId);
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    return product;
  },

  async create(sellerId: string, input: AddProductInput) {
    // Seller must be verified before listing products
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: sellerId },
    });
    if (!profile || profile.profileStatus !== "VERIFIED") {
      throw ERR.FORBIDDEN; //API returns 403 - "Seller not yet verified"
    }

    const { priceTiers, ...rest } = input;
    return prisma.product.create({
      data: {
        ...rest,
        sellerId,
        city: profile.city,
        priceTiers: { create: priceTiers },
      },
      include: { priceTiers: true },
    });
  },

  async update(productId: string, sellerId: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId != sellerId) throw ERR.FORBIDDEN;

    const { priceTiers, minOrderQty, maxOrderQty, ...rest } = input;
    return prisma.product.update({
      where: { id: productId },
      data: {
        ...rest,
        minOrderQuantity: minOrderQty,
        maxOrderQuantity: maxOrderQty,
        // Replace all price tiers atomically when supplied
        ...(priceTiers
          ? { priceTiers: { deleteMany: {}, create: priceTiers } }
          : {}), // Performs a conditional nested write that atomically deletes existing relations and recreates them, ensuring data consistency.
      },
      include: { priceTiers: true },
    });
  },

  async softDelete(productId: string, sellerId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;
    if (product.sellerId != sellerId) throw ERR.FORBIDDEN;

    return await prisma.product.update({
      where: { id: productId },
      data: {
        productStatus: "DELETED",
        deletedAt: new Date(),
      },
    });
  },
};
