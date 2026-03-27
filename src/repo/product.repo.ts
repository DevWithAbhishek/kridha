// src/repos/product.repo.ts
import { prisma } from "@/lib/db";
import { PriceTier, Prisma } from "@prisma/client";
import type { GetProductsInput } from "@/schemas";

interface ProductRow {
  id: string;
  nameEn: string;
  nameHi: string | null;
  description: string | null;
  category: string;
  sellerId: string;
  isBranded: boolean;
  unit: string;
  unitIncrement: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  available: number;
  imageUrls: string[];
  blurHash: string | null;
  latitude: number;
  longitude: number;
  city: string;
  productStatus: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  distance_km: number; // ST_Distance / 1000, used for display
  min_price: number; // MIN(priceTier.pricePerUnit)
}

export interface ProductWithRelations extends ProductRow {
  priceTiers: PriceTier[];
  dealDiscountPercent: number | null;
  dealExpiresAt: Date | null;
}

export const productRepo = {
  async findNearby(input: GetProductsInput, excludeSellerId?: string) {
    const radiusM = (input.radius ?? 10) * 1000;
    const safePage = Math.max(1, input.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, input.limit ?? 20));
    const offset = (safePage - 1) * safeLimit;

    // WHERE clause fragments
    const catClause = input.category
      ? Prisma.sql`AND p.category::text = ${input.category as string}`
      : Prisma.empty;
    const brandClause =
      input.isBranded !== undefined
        ? Prisma.sql`AND p."isBranded" = ${input.isBranded}`
        : Prisma.empty;
    const exClause = excludeSellerId
      ? Prisma.sql`AND p."sellerId" != ${excludeSellerId}`
      : Prisma.empty;
    const searchClause = input.q
      ? Prisma.sql`AND (p."nameEn" ILIKE ${"%" + input.q + "%"} OR p."nameHi" ILIKE ${"%" + input.q + "%"})`
      : Prisma.empty;

    // ORDER BY — KNN operator <-> uses GIST index for distance ordering
    const orderClause =
      input.sortBy === "price_asc"
        ? Prisma.sql`ORDER BY min_price ASC NULLS LAST`
        : Prisma.sql`ORDER BY p.location <-> ST_MakePoint(${input.lng}, ${input.lat})::geography ASC`;

    const baseWhere = Prisma.sql`
      WHERE p."productStatus" = 'ACTIVE'
        AND p."deletedAt" IS NULL
        AND ST_DWithin(
          p.location,
          ST_MakePoint(${input.lng}, ${input.lat})::geography,
          ${radiusM}
        )
        ${catClause} ${brandClause} ${exClause} ${searchClause}
    `;

    // Run data + count in parallel
    const [rows, countResult] = await Promise.all([
      prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT
          p.*,
          ST_Distance(p.location, ST_MakePoint(${input.lng}, ${input.lat})::geography) / 1000
            AS distance_km,
          (SELECT MIN(pt."pricePerUnit") FROM "PriceTier" pt WHERE pt."productId" = p.id)
            AS min_price
        FROM "Product" p
        ${baseWhere}
        ${orderClause}
        LIMIT ${safeLimit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "Product" p ${baseWhere}
      `),
    ]);

    const total = Number(countResult[0].count);
    const ids = rows.map((r) => r.id);

    if (!ids.length) {
      return {
        products: [],
        meta: { page: safePage, limit: safeLimit, total: 0, hasMore: false },
      };
    }

    // Fetch relations in parallel — one query each regardless of page size
    const [tiers, deals] = await Promise.all([
      prisma.priceTier.findMany({ where: { productId: { in: ids } } }),
      prisma.deal.findMany({
        where: { productId: { in: ids }, status: "ACTIVE" },
      }),
    ]);

    const tierMap = new Map<string, typeof tiers>();
    const dealMap = new Map<string, (typeof deals)[0]>();
    for (const t of tiers)
      tierMap.set(t.productId, [...(tierMap.get(t.productId) ?? []), t]);
    for (const d of deals) dealMap.set(d.productId, d);

    const products: ProductWithRelations[] = rows.map((r) => ({
      ...r,
      priceTiers: tierMap.get(r.id) ?? [],
      dealDiscountPercent: dealMap.get(r.id)?.discountPercent ?? null,
      dealExpiresAt: dealMap.get(r.id)?.expiresAt ?? null,
    }));

    return {
      products,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        hasMore: offset + products.length < total,
      },
    };
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id, productStatus: "ACTIVE", deletedAt: null },
      include: {
        priceTiers: true,
        deals: { where: { status: "ACTIVE" }, take: 1 },
        seller: { include: { pickupWindows: { where: { deletedAt: null } } } },
      },
    });
  },

  async findBySeller(
    sellerId: string,
    status: string,
    page: number,
    limit: number,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    return prisma.product.findMany({
      where: { sellerId, productStatus: status as any },
      include: {
        priceTiers: true,
        deals: { where: { status: "ACTIVE" }, take: 1 },
        _count: { select: { orderItems: true } },
      },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      orderBy: { createdAt: "desc" },
    });
  },
};
