-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Generated location column on Product (used by GIST index)
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326)
  GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED;

-- GIST index on location — used by ST_DWithin + <-> operator
CREATE INDEX IF NOT EXISTS product_location_gist
  ON "Product" USING GIST (location);

-- GIN trigram indexes for ILIKE search
CREATE INDEX IF NOT EXISTS product_name_en_trgm
  ON "Product" USING GIN ("nameEn" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_name_hi_trgm
  ON "Product" USING GIN ("nameHi" gin_trgm_ops);

-- Existing B-tree indexes (keep these)
CREATE INDEX IF NOT EXISTS product_city_cat ON "Product" (city, category, "deletedAt");
CREATE INDEX IF NOT EXISTS product_seller   ON "Product" ("sellerId", "productStatus");