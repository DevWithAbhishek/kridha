import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  buildWhereClause,
  buildOrderClause,
  type NearbyFilters,
} from "@/lib/postgis";
import type { GetProductsInput, GetSellerProductsInput } from "@/schemas";
import { Product } from "@prisma/client";
import { PriceTier } from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Typed result of the raw PostGIS query
// ---------------------------------------------------------------------------
export interface ProductRow extends Product {
  // computed by PostGIS
  distance_km: number;
  // computed by lateral subquery
  min_price: number | null;
}

export interface ProductWithRelations extends ProductRow {
  priceTiers: Array<PriceTier>;
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

// ---------------------------------------------------------------------------
// Helper — merge relations into raw rows
// ---------------------------------------------------------------------------
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
          where: { sellerId: { in: sellerIds }, deletedAt: null },
        })
      : Promise.resolve([]),
  ]);

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

// ---------------------------------------------------------------------------
export const productRepo = {
  async findNearby(
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

    // -----------------------------------------------------------------------
    // DATA QUERY
    // -----------------------------------------------------------------------
    const dataQuery = Prisma.sql`
  SELECT
    p.*,
    ST_Distance(
      COALESCE(p.location, ST_SetSRID(ST_MakePoint(p."longitude", p."latitude"), 4326)::geography),
      ST_MakePoint(${input.lng}, ${input.lat})::geography
    ) / 1000 AS distance_km,

    -- FIX: price at minOrderQuantity, not MIN() across all tiers
    -- Finds the highest minQty tier that is still <= minOrderQuantity
    -- This matches exactly what calcUnitPrice() returns for a new buyer
    (
  SELECT
    CASE
      WHEN d."discountPercent" IS NOT NULL
        THEN ROUND(
          (pt."pricePerUnit" * (1 - d."discountPercent" / 100.0))::numeric,
          2
        )
      ELSE pt."pricePerUnit"
    END
  FROM "PriceTier" pt
  LEFT JOIN "Deal" d
    ON d."productId" = pt."productId"
    AND d."status"    = 'ACTIVE'
    AND d."expiresAt" > NOW()
  WHERE pt."productId" = p.id
    AND pt."minQty"    <= p."minOrderQuantity"
  ORDER BY pt."minQty" DESC
  LIMIT 1
) AS min_price

  FROM "Product" p
  ${whereClause}
  ${orderClause}
  LIMIT ${safeLimit} OFFSET ${offset}
`;
    // -----------------------------------------------------------------------
    // COUNT QUERY
    // -----------------------------------------------------------------------
    const countQuery = Prisma.sql`
  SELECT COUNT(*) AS count
  FROM "Product" p

  -- ✅ Same filters applied → guarantees consistency
  ${whereClause}
`;

    const [rows, countResult] = await Promise.all([
      prisma.$queryRaw<ProductRow[]>(dataQuery),
      prisma.$queryRaw<[{ count: bigint }]>(countQuery),
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
        hasMore: offset + products.length < total,
      },
    };
  },

  async findById(id: string): Promise<ProductWithRelations | null> {
    const product = await prisma.product.findFirst({
      where: {
        id,
        productStatus: "ACTIVE",
        deletedAt: null,
      },
      include: {
        priceTiers: {
          select: {
            id: true,
            productId: true,
            minQty: true,
            maxQty: true,
            pricePerUnit: true,
          },
        },
        deals: {
          where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          orderBy: {
            expiresAt: "asc",
          },
          take: 1,
        },
        seller: {
          select: {
            userId: true,
            storeName: true,
            sellerRating: true,
            reliabilityScore: true,
            user: { select: { id: true, name: true } },
            pickupWindows: {
              // ← nested inside seller
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!product) return null;
    const activeDeal = product.deals[0] ?? null;

    return {
      ...product,
      distance_km: 0,
      min_price: null,
      dealDiscountPercent: activeDeal?.discountPercent ?? null,
      dealExpiresAt: activeDeal?.expiresAt ?? null,
      seller: product.seller
        ? {
            id: product.seller.user.id,
            name: product.seller.user.name,
            storeName: product.seller.storeName,
            reliabilityScore: product.seller.reliabilityScore,
            sellerRating: product.seller.sellerRating,
          }
        : undefined,
      pickupWindows: product.seller?.pickupWindows?.map((w) => ({
        id: w.id,
        labelEn: w.labelEn,
        labelHi: w.labelHi,
        startTime: w.startTime,
        endTime: w.endTime,
        daysActive: w.daysActive,
      })),
    };
  },

  async findBySeller(sellerId: string, input: GetSellerProductsInput) {
    const safePage = Math.max(1, input.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, input.limit ?? 20));

    return prisma.product.findMany({
      where: {
        sellerId,
        productStatus: (input.status ?? "ACTIVE") as never,
      },
      include: {
        priceTiers: true,
        deals: {
          where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          take: 1,
        },
        _count: { select: { orderItems: true } },
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
