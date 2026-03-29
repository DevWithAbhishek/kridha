import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildWhereClause,
  buildOrderClause,
  NearbyFilters,
} from "@/lib/postgis";
import {
  AddPickupWindowSchema,
  type GetProductsInput,
  type GetSellerProductsInput,
} from "@/schemas";

//typed result of the raw PostGIS query
export interface ProductRow {
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
  //computed by PostGIS
  distance_km: number;
  // computed by lateral subquery
  min_price: number | null;
}

export interface ProductWithRelations extends ProductRow {
  priceTiers: Array<{
    minQty: number;
    maxQty: number | null;
    pricePerUnit: number;
  }>;
  dealDiscountPercent: number | null;
  dealExpiresAt: Date | null;
  seller?: {
    id: string;
    name: string;
    storeName: string;
    reliabilityScore: number;
    sellerRating: number;
  };
  pickupWindows?: Array<{
    id: string;
    labelEn: string;
    labelHi: string;
    startTime: string;
    endTime: string;
    daysActive: number[];
  }>;
}

// Helper — merge relations into raw rows
async function attachRelations(
  rows: ProductRow[],
  opts: { includeSeller?: boolean; includePickupWindows?: boolean } = {},
): Promise<ProductWithRelations[]> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const sellerIds = [...new Set(rows.map((r) => r.sellerId))];
  const [tiers, deals, sellers, windows] = await Promise.all([
    prisma.priceTier.findMany({ where: { productId: { in: ids } } }),
    prisma.deal.findMany({
      where: {
        productId: { in: ids },
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    }),
    opts.includeSeller
      ? prisma.sellerProfile.findMany({
          where: { userId: { in: sellerIds } },
          select: {
            userId: true,
            storeName: true,
            sellerRating: true,
            reliabilityScore: true,
            user: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    opts.includePickupWindows
      ? prisma.pickupWindow.findMany({
          where: { sellerId: { in: ids }, deletedAt: null },
        })
      : Promise.resolve([]),
  ]);

  // Build maps for O(1) lookup
  const tierMap = new Map<string, typeof tiers>();
  const dealMap = new Map<string, (typeof deals)[0]>();
  const sellerMap = new Map<string, (typeof sellers)[0]>();
  const windowMap = new Map<string, typeof windows>();

  for (const t of tiers) {
    const arr = tierMap.get(t.productId) ?? [];
    arr.push(t);
    tierMap.set(t.productId, arr);
  }

  for (const d of deals) dealMap.set(d.productId, d);
  for (const s of sellers) sellerMap.set(s.userId, s);
  for (const w of windows) {
    const arr = windowMap.get(w.sellerId) ?? [];
    arr.push(w);
    windowMap.set(w.sellerId, arr);
  }

  return rows.map((r) => {
    const sellerData = sellerMap.get(r.sellerId);
    const winData = windowMap.get(r.sellerId) ?? [];
    const deal = dealMap.get(r.id);

    return {
      ...r,
      priceTiers: tierMap.get(r.id) ?? [],
      dealDiscountPercent: deal?.discountPercent ?? null,
      dealExpiresAt: deal?.expiresAt ?? null,
      ...(opts.includeSeller && sellerData
        ? {
            seller: {
              id: sellerData.user.id,
              name: sellerData.user.name,
              storeName: sellerData.storeName,
              reliabilityScore: sellerData.reliabilityScore,
              sellerRating: sellerData.sellerRating,
            },
          }
        : {}),
      ...(opts.includePickupWindows
        ? {
            pickupWindows: winData.map((w) => ({
              id: w.id,
              labelEn: w.labelEn,
              labelHi: w.labelHi,
              startTime: w.startTime,
              endTime: w.endTime,
              daysActive: w.daysActive,
            })),
          }
        : {}),
    };
  });
}

export const productRepo = {
  async findNearBy(
    input: GetProductsInput,
    excludeSellerId?: string,
  ): Promise<{
    products: ProductWithRelations[];
    meta: { page: number; limit: number; total: number; hasMore: boolean };
  }> {
    const safePage = Math.max(1, input.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, input.limit ?? 20));
    const offset = (safePage - 1) * safeLimit;
    const radiusM = (input.radius ?? 10) * 1000;
    const filters: NearbyFilters = {
      lat: input.lat,
      lng: input.lng,
      radiusM,
      category: input.category,
      isBranded: input.isBranded,
      dealActive: input.dealActive,
      q: input.q,
      excludeSellerId,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      sortBy: input.sortBy as NearbyFilters["sortBy"],
      limit: safeLimit,
      offset,
    };

    const whereClause = buildWhereClause(filters);
    const orderClause = buildOrderClause(filters.sortBy, input.lat, input.lng);

    // price HAVING filters (min_price is a lateral subquery alias)
    const priceHavingClause = (() => {
      const parts: Prisma.Sql[] = [];
      if (input.minPrice !== undefined)
        parts.push(Prisma.sql`min_price >= ${input.minPrice}`);
      if (input.maxPrice !== undefined)
        parts.push(Prisma.sql`min_price <= ${input.maxPrice}`);
      if (!parts.length) return Prisma.empty;
      return Prisma.sql`HAVING ${Prisma.join(parts, "AND")}`;
    })();

    // Run data + COUNT in parallel
    const [rows, countResult] = await Promise.all([
      prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT
        p.*,
        ST_Distance(
          p.location,
          ST_MakePoint(${filters.lng}, ${filters.lat})::geography
        ) / 1000 AS distance_km,
        -- Lateral subquery to get min price per product (after main WHERE filters)
        (
          SELECT MIN(pt."pricePerUnit")
          FROM "PriceTier" pt
          WHERE pt."productId" = p.id
        ) AS min_price
        FROM "Product" p
        ${whereClause}
        ${priceHavingClause}
        ${orderClause}
        LIMIT ${filters.limit} OFFSET ${filters.offset}
        `),

      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "product" p
        ${whereClause}
        `),
    ]);

    const total = Number(countResult[0].count);
    const products = await attachRelations(rows, {
      includeSeller: true,
      includePickupWindows: true,
    });

    return {
      products,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        hasMore: offset + safeLimit < total,
      },
    };
  },

  async findById(id: string): Promise<ProductWithRelations | null> {
    const rows = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
      SELECT p.*, 0 AS distance_km, NULL AS min_price
      FROM "product" p
      WHERE p.id = ${id}
      AND p."productStatus" = 'ACTIVE'
      AND p."deletedAt" IS NULL
      LIMIT 1
      `);

    if (!rows.length) return null;
    const [product] = await attachRelations(rows, {
      includeSeller: true,
      includePickupWindows: true,
    });

    return product ?? null;
  },

  async findBySeller(sellerId: string, input: GetSellerProductsInput) {
    const safePage = Math.max(1, input.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, input.limit ?? 20));

    return prisma.product.findMany({
      where: {
        sellerId,
        productStatus: (input.status ?? "ACTIVE") as ProductStatus,
      },
      include: {
        sellerId,
        deals: {
          where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          take: 1,
        },
        _count: { select: { orderItems: true } }, // totalOrders - never stored
      },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      orderBy: { createdAt: "desc" },
    });
  },

  async findBySellerAndId(productId: string, sellerId: string) {
    return prisma.product.findFirst({
      where: { id: productId, sellerId },
      include: {
        priceTiers: true,
        deals: {
          where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          take: 1,
        },
        _count: { select: { orderItems: true } },
      },
    });
  },
};
