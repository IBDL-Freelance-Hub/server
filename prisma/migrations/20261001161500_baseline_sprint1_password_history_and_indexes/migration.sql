-- SecurityConfig missing fields from Sprint 1 baseline
ALTER TABLE "SecurityConfig" ADD COLUMN IF NOT EXISTS "singleLineFieldMaxLength" INTEGER NOT NULL DEFAULT 250;
ALTER TABLE "SecurityConfig" ADD COLUMN IF NOT EXISTS "multiLineFieldMaxLength" INTEGER NOT NULL DEFAULT 5000;

-- PasswordHistory table from Sprint 1 baseline
CREATE TABLE IF NOT EXISTS "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- Missing indexes
CREATE INDEX IF NOT EXISTS "User_status_createdAt_idx" ON "User"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Member_directoryOptIn_idx" ON "Member"("directoryOptIn");
CREATE INDEX IF NOT EXISTS "Member_directoryOptIn_profileCompletionRate_idx" ON "Member"("directoryOptIn", "profileCompletionRate");
CREATE INDEX IF NOT EXISTS "Member_directoryOptIn_createdAt_idx" ON "Member"("directoryOptIn", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Member_createdAt_idx" ON "Member"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Membership_memberId_createdAt_idx" ON "Membership"("memberId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "File_ownerId_status_idx" ON "File"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_resourceId_idx" ON "AuditLog"("action", "resourceId");
CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt" DESC);

-- Foreign Keys for PasswordHistory
DO $$ BEGIN
    ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
