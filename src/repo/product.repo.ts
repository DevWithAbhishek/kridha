// src/repos/product.repo.ts
import { prisma } from "@/lib/db";
import { PriceTier, Prisma, ProductStatus } from "@prisma/client";
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

    // ORDER BY — KNN operator <-> uses GIST index for distance ordering. NULLS LAST ensures that rows with NULL values in min_price appear at the end of the sorted result.
    const orderClause =
      input.sortBy === "price_asc"
        ? Prisma.sql`ORDER BY min_price ASC NULLS LAST`
        : Prisma.sql`ORDER BY p.location <-> ST_MakePoint(${input.lng}, ${input.lat})::geography ASC`; // <->: distance between two points (uses GIST index,very fast sorting)

    // Checks whether a point (p.location) lies within a given distance (radiusM) from another point (user’s lat/lng). ST_MakePoint(lng, lat) creates a point → cast to geography for accurate earth-distance → ST_DWithin performs a fast spatial index–optimized distance check.
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
    // Q1: Fetches products with computed distance (km) from user and minimum price per product, with pagination.Uses raw SQL via Prisma → ST_Distance calculates distance from user location → subquery gets MIN(pricePerUnit) → applies filters (baseWhere), sorting (orderClause), LIMIT/OFFSET.
    // Q2: Returns the total number of products matching the given filters (baseWhere). Executes raw SQL → COUNT(*) aggregates rows → Prisma types result as { count: bigint } to handle large counts safely.
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

    // Converts DB bigint → JS number, maps rows to ids, and if no IDs exist, returns an immediate response with empty products and pagination meta. Extracts total count, collects product IDs, and handles the empty result case early.
    const total = Number(countResult[0].count);
    const ids = rows.map((r) => r.id); // loops over fetched products (rows) and collects each id into an array => ids is an array of product IDs extracted from the query result.
    if (!ids.length) {
      return {
        products: [],
        meta: { page: safePage, limit: safeLimit, total: 0, hasMore: false },
      };
    }

    // Fetch relations in parallel — one query each regardless of page size ----> Avoids N+1 problem. Fetches priceTier and deal data independently for the same set of product IDs.
    const [tiers, deals] = await Promise.all([
      prisma.priceTier.findMany({ where: { productId: { in: ids } } }),
      prisma.deal.findMany({
        where: { productId: { in: ids }, status: "ACTIVE" },
      }),
    ]);

    // Creates two lookup maps: one for grouping tiers by productId, and one for mapping a single deal per productId.
    const tierMap = new Map<string, typeof tiers>(); // key = productId, value = array of tiers
    const dealMap = new Map<string, (typeof deals)[0]>(); // key = productId, value = one deal object

    // Groups all tiers by productId into tierMap (one product → multiple tiers). For each t, it gets existing array (tierMap.get(...) ?? []), appends current tier, and sets it back → effectively building an array per product.
    for (const t of tiers)
      tierMap.set(t.productId, [...(tierMap.get(t.productId) ?? []), t]);

    // Maps each deal to its productId in dealMap (one product → one active deal). Loops over deals and sets the deal object directly under its productId key, assuming at most one active deal per product.
    for (const d of deals) dealMap.set(d.productId, d);

    // Avoids N+1 problem by attaching related priceTiers and deal info to each product in a single loop, using the pre-built maps. For each product row, it constructs a ProductWithRelations object by spreading the row data and adding priceTiers from tierMap and deal info from dealMap. If no tiers or deals exist for a product, it defaults to an empty array or null values.
    // This way, we enrich each product with its related data without needing additional queries per product, thus maintaining efficient pagination and data retrieval.
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
      // Fetches a single active product by id with related data (price tiers, active deal, seller + pickup windows). findUnique with filters → include loads relations: all priceTiers, one active deal (take: 1), and seller with non-deleted pickupWindows.
      return prisma.product.findUnique({
        where: { id, productStatus: "ACTIVE", deletedAt: null },
        include: {
          priceTiers: true,
          deals: { where: { status: "ACTIVE" }, take: 1 },
          seller: {
            include: { pickupWindows: { where: { deletedAt: null } } },
          },
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
    // Fetches a seller’s products list with pricing, active deal, and order count, sorted by newest and paginated.
    // findMany → filters by sellerId + status → include loads relations (priceTiers, 1 active deal, _count.orderItems) → applies pagination via skip/take → sorts by createdAt DESC.
    return prisma.product.findMany({
      where: { sellerId, productStatus: status as ProductStatus },
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
