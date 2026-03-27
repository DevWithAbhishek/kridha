/*
  Warnings:

  - You are about to drop the column `location` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "product_location_gist";

-- DropIndex
DROP INDEX "product_name_en_trgm";

-- DropIndex
DROP INDEX "product_name_hi_trgm";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "location";
