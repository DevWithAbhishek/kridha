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
  // FIX: COALESCE handles NULL location — falls back to lat/lng columns
  // This makes ST_DWithin work even if the generated column isn't populated
  const geoFilter = Prisma.sql`
    AND ST_DWithin(
        COALESCE(
          p."location",
          ST_SetSRID(ST_MakePoint(p."longitude", p."latitude"), 4326)::geography
        ),
        ST_MakePoint(${f.lng}, ${f.lat})::geography,
        ${f.radiusM}
    )`;

  const categoryClause = f.category
    ? Prisma.sql`AND p."category" = ${f.category}::"ProductCategory"`
    : Prisma.empty;

  const brandedClause =
    f.isBranded !== undefined
      ? Prisma.sql`AND p."isBranded" = ${f.isBranded}`
      : Prisma.empty;

  const dealClause = f.dealActive
    ? Prisma.sql`
        AND EXISTS (
            SELECT 1 FROM "Deal" d
            WHERE d."productId" = p.id
            AND d."status" = 'ACTIVE'
            AND d."expiresAt" > NOW()
        )`
    : Prisma.empty;

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

  const priceExistsClause =
    Number.isFinite(f.minPrice) || Number.isFinite(f.maxPrice)
      ? Prisma.sql`
      AND EXISTS (
        SELECT 1 FROM "PriceTier" pt
        WHERE pt."productId" = p.id
        ${
          Number.isFinite(f.minPrice)
            ? Prisma.sql`AND pt."pricePerUnit" >= ${f.minPrice}`
            : Prisma.empty
        }
        ${
          Number.isFinite(f.maxPrice)
            ? Prisma.sql`AND pt."pricePerUnit" <= ${f.maxPrice}`
            : Prisma.empty
        }
      )`
      : Prisma.empty;

  return Prisma.sql`
    WHERE p."productStatus" = 'ACTIVE'
    AND p."deletedAt" IS NULL
    ${geoFilter}
    ${categoryClause}
    ${brandedClause}
    ${dealClause}
    ${searchClause}
    ${excludeClause}
    ${priceExistsClause}
  `;
}

export function buildOrderClause(
  sortBy: NearbyFilters["sortBy"],
  lat: number,
  lng: number,
): Prisma.Sql {
  if (sortBy === "price_asc")
    return Prisma.sql`ORDER BY min_price ASC NULLS LAST`;
  if (sortBy === "price_desc")
    return Prisma.sql`ORDER BY min_price DESC NULLS LAST`;

  // FIX: COALESCE guards NULL location in KNN operator too
  return Prisma.sql`
    ORDER BY COALESCE(
      p.location,
      ST_SetSRID(ST_MakePoint(p."longitude", p."latitude"), 4326)::geography
    ) <-> ST_MakePoint(${lng}, ${lat})::geography ASC`;
}