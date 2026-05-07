-- AlterTable (idempotent — pin may already be gone, pinHash may already exist)
ALTER TABLE "User" DROP COLUMN IF EXISTS "pin";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'User' 
    AND column_name = 'pinHash'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "pinHash" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartSessionId_productId_pickupWindowId_pickupDate_key" 
ON "CartItem"("cartSessionId", "productId", "pickupWindowId", "pickupDate");