import { Prisma, ProductCategory } from "@prisma/client";

export interface NearbyFilters {
  lat: number;
  lng: number;
  radiusM: number;
  category?: ProductCategory;
  isBranded?: boolean;
  dealActive?: boolean;
  q?: string;
  excludeSellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "distance" | "price_asc" | "price_desc";
  limit: number;
  offset: number;
}

/**
 * Build the WHERE fragment for the PostGIS radius query.
 * All filters are composable — only included when values are present.
 */

export function buildWhereClause(f: NearbyFilters): Prisma.Sql {
  // Filters products within a given radius from user location using PostGIS ST_DWithin (index-optimized distance check).
  const geoFilter = Prisma.sql`
    AND ST_DWithin(
        p.location,
        ST_MakePoint(${f.lng}, ${f.lat})::geography,
        ${f.radiusM}
    )`;

  const categoryClause = f.category
    ? Prisma.sql`AND p.category::text = ${f.category}`
    : Prisma.empty;

  const brandedClause =
    f.isBranded !== undefined
      ? Prisma.sql`AND p."isBranded" = ${f.isBranded}`
      : Prisma.empty;

  // dealActive = true → Conditionally adds a filter to return only products having at least one currently active (non-expired) deal using EXISTS.
  const dealClause = f.dealActive
    ? Prisma.sql`
        AND EXISTS (
            SELECT 1 FROM "Deal" d
            WHERE d."productId" = p.id
            AND d.status = 'ACTIVE'
            AND d.expiresAt > NOW()
        )`
    : Prisma.empty;

  // ILIKE uses the pg_trgm GIN index on nameEn / nameHi
  const searchClause = f.q
    ? Prisma.sql`
    AND (
        p."nameEn" ILIKE ${"%" + f.q + "%"}
        OR p."nameHi" ILIKE ${"%" + f.q + "%"}
    )`
    : Prisma.empty;

  const excludeClause = f.excludeSellerId
    ? Prisma.sql`AND p."sellerId" != ${f.excludeSellerId}`
    : Prisma.empty;

  // Price range filters operate on MIN(priceTier.pricePerUnit)
  // Evaluated as a HAVING clause in the outer query via min_price alias
  // These are applied post-aggregation — handled in the outer SELECT, not here
  // (minPrice / maxPrice filtering is done in buildDataQuery via HAVING)

  return Prisma.sql`
    WHERE p."productStatus" = 'ACTIVE'
    AND p."deletedAt" IS NULL
    ${geoFilter}
    ${categoryClause}
    ${brandedClause}
    ${dealClause}
    ${searchClause}
    ${excludeClause}`;
}

/**
 * ORDER BY clause.
 * distance: KNN operator <-> uses the GIST index — fastest.
 * price_asc / price_desc: uses the min_price lateral subquery result.
 * Dynamically applies sorting by price or distance, using NULLS LAST for price and PostGIS KNN <-> operator for efficient nearest-first ordering.
 */

export function buildOrderClause(
  sortBy: NearbyFilters["sortBy"],
  lat: number,
  lng: number,
): Prisma.Sql {
  if (sortBy === "price_asc")
    return Prisma.sql`ORDER BY min_price ASC NULLS LAST`;
  if (sortBy === "price_desc")
    return Prisma.sql`ORDER BY min_price DESC NULLS LAST`;
  // Default: distance - KNN <-> operator uses the GIST index
  return Prisma.sql`
    ORDER BY p.location <-> ST_MakePoint(${lng}, ${lat})::geography ASC`;
}
