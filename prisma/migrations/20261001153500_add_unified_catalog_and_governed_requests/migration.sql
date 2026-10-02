-- Step 1: Create PricingModel and CatalogItemCategory enums if not exist
DO $$ BEGIN
    CREATE TYPE "PricingModel" AS ENUM ('IN_HUB', 'PERCENTAGE', 'INCLUDED_OR_QUOTED', 'QUOTED', 'FIXED', 'FREE_THEN_PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CatalogItemCategory" AS ENUM ('CORE_SERVICE', 'DIAGNOSTIC_TOOL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Handle EngagementRequestStatus enum with safe mapping of existing rows
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON t.typnamespace = n.oid 
        WHERE n.nspname = current_schema() AND t.typname = 'EngagementRequestStatus'
    ) THEN
        -- Create the replacement enum
        CREATE TYPE "EngagementRequestStatus_new" AS ENUM (
            'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'AWAITING_PAYMENT',
            'PAYMENT_CONFIRMED', 'FULFILLED', 'REJECTED', 'CANCELLED'
        );

        -- If table exists in current schema, migrate existing rows safely using semantic mapping
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = current_schema() AND table_name = 'EngagementRequest'
        ) THEN
            ALTER TABLE "EngagementRequest" ALTER COLUMN "status" DROP DEFAULT;
            ALTER TABLE "EngagementRequest" ALTER COLUMN "status" TYPE "EngagementRequestStatus_new" USING (
                CASE "status"::text
                    WHEN 'PENDING_PAYMENT' THEN 'AWAITING_PAYMENT'::"EngagementRequestStatus_new"
                    WHEN 'IN_REVIEW'       THEN 'UNDER_REVIEW'::"EngagementRequestStatus_new"
                    WHEN 'IN_PROGRESS'     THEN 'PAYMENT_CONFIRMED'::"EngagementRequestStatus_new"
                    WHEN 'COMPLETED'       THEN 'FULFILLED'::"EngagementRequestStatus_new"
                    WHEN 'CANCELLED'       THEN 'CANCELLED'::"EngagementRequestStatus_new"
                    WHEN 'REJECTED'        THEN 'REJECTED'::"EngagementRequestStatus_new"
                    ELSE 'SUBMITTED'::"EngagementRequestStatus_new"
                END
            );
            ALTER TABLE "EngagementRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"EngagementRequestStatus_new";
        END IF;

        DROP TYPE "EngagementRequestStatus";
        ALTER TYPE "EngagementRequestStatus_new" RENAME TO "EngagementRequestStatus";
    ELSE
        CREATE TYPE "EngagementRequestStatus" AS ENUM (
            'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'AWAITING_PAYMENT',
            'PAYMENT_CONFIRMED', 'FULFILLED', 'REJECTED', 'CANCELLED'
        );
    END IF;
END $$;

-- Step 3: Create CatalogItem table if not exists, or add new columns
CREATE TABLE IF NOT EXISTS "CatalogItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "CatalogItemCategory" NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'QUOTED',
    "packageLevel" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "percentageRate" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- Ensure columns exist if table was previously created
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "pricingModel" "PricingModel" NOT NULL DEFAULT 'QUOTED';
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "packageLevel" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "percentageRate" DECIMAL(5,2);

-- Step 4: Create EngagementRequest table if not exists, or add new columns
CREATE TABLE IF NOT EXISTS "EngagementRequest" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "category" "CatalogItemCategory" NOT NULL,
    "status" "EngagementRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'QUOTED',

    "tierAtRequest" "MembershipTier" NOT NULL,
    "membershipStatusAtRequest" "MembershipStatus" NOT NULL,
    "standardPrice" DECIMAL(10,2),
    "percentageRate" DECIMAL(5,2),

    "brief" JSONB,
    "customRequirements" TEXT,
    "intakeData" JSONB,
    "acknowledgement" BOOLEAN NOT NULL DEFAULT false,

    "baseAmount" DECIMAL(10,2),
    "basePrice" DECIMAL(10,2),
    "discountPercentage" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isQuarterlyEntitlement" BOOLEAN NOT NULL DEFAULT false,
    "quarterIndex" INTEGER,
    "membershipYear" INTEGER,

    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),

    "adminNotes" TEXT,
    "reviewNotes" TEXT,
    "cancellationReason" TEXT,
    "rejectionReason" TEXT,
    "infoRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementRequest_pkey" PRIMARY KEY ("id")
);

-- Ensure all new columns exist on EngagementRequest
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "pricingModel" "PricingModel" NOT NULL DEFAULT 'QUOTED';
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "standardPrice" DECIMAL(10,2);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "percentageRate" DECIMAL(5,2);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "brief" JSONB;
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "acknowledgement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(10,2);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "infoRequestedAt" TIMESTAMP(3);
ALTER TABLE "EngagementRequest" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- Step 5: Concurrency-Safe Sequential Counter Table (REQ-YYYY-0nnn)
CREATE TABLE IF NOT EXISTS "RequestSequenceCounter" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestSequenceCounter_pkey" PRIMARY KEY ("year")
);

-- Step 6: Create Indexes and Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_slug_key" ON "CatalogItem"("slug");
CREATE INDEX IF NOT EXISTS "CatalogItem_category_isActive_idx" ON "CatalogItem"("category", "isActive");
CREATE INDEX IF NOT EXISTS "CatalogItem_slug_idx" ON "CatalogItem"("slug");
CREATE INDEX IF NOT EXISTS "CatalogItem_pricingModel_idx" ON "CatalogItem"("pricingModel");

CREATE UNIQUE INDEX IF NOT EXISTS "EngagementRequest_referenceCode_key" ON "EngagementRequest"("referenceCode");
CREATE INDEX IF NOT EXISTS "EngagementRequest_memberId_status_idx" ON "EngagementRequest"("memberId", "status");
CREATE INDEX IF NOT EXISTS "EngagementRequest_memberId_catalogItemId_status_idx" ON "EngagementRequest"("memberId", "catalogItemId", "status");
CREATE INDEX IF NOT EXISTS "EngagementRequest_memberId_createdAt_idx" ON "EngagementRequest"("memberId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EngagementRequest_referenceCode_idx" ON "EngagementRequest"("referenceCode");
CREATE INDEX IF NOT EXISTS "EngagementRequest_category_status_idx" ON "EngagementRequest"("category", "status");
CREATE INDEX IF NOT EXISTS "EngagementRequest_entitlement_idx" ON "EngagementRequest"("memberId", "isQuarterlyEntitlement", "quarterIndex", "membershipYear");

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "EngagementRequest" ADD CONSTRAINT "EngagementRequest_memberId_fkey"
        FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "EngagementRequest" ADD CONSTRAINT "EngagementRequest_catalogItemId_fkey"
        FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
