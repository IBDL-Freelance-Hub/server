-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "CatalogItemCategory" ADD VALUE 'BUSINESS_SIMULATION';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "CatalogItemCategory" ADD VALUE 'PROFESSIONAL_RECOGNITION';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "PricingModel" ADD VALUE 'NONE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "CatalogItem" ALTER COLUMN "basePrice" DROP DEFAULT;
ALTER TABLE "CatalogItem" ALTER COLUMN "basePrice" TYPE INTEGER USING (ROUND("basePrice" * 100)::INTEGER);
ALTER TABLE "CatalogItem" ALTER COLUMN "basePrice" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "EngagementRequest" ALTER COLUMN "basePrice" TYPE INTEGER USING (CASE WHEN "basePrice" IS NOT NULL THEN ROUND("basePrice" * 100)::INTEGER ELSE NULL END);
ALTER TABLE "EngagementRequest" ALTER COLUMN "finalPrice" TYPE INTEGER USING (CASE WHEN "finalPrice" IS NOT NULL THEN ROUND("finalPrice" * 100)::INTEGER ELSE NULL END);
ALTER TABLE "EngagementRequest" ALTER COLUMN "baseAmount" TYPE INTEGER USING (CASE WHEN "baseAmount" IS NOT NULL THEN ROUND("baseAmount" * 100)::INTEGER ELSE NULL END);
ALTER TABLE "EngagementRequest" ALTER COLUMN "discountAmount" TYPE INTEGER USING (CASE WHEN "discountAmount" IS NOT NULL THEN ROUND("discountAmount" * 100)::INTEGER ELSE NULL END);
ALTER TABLE "EngagementRequest" ALTER COLUMN "standardPrice" TYPE INTEGER USING (CASE WHEN "standardPrice" IS NOT NULL THEN ROUND("standardPrice" * 100)::INTEGER ELSE NULL END);

-- AlterTable
ALTER TABLE "RequestSequenceCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;
