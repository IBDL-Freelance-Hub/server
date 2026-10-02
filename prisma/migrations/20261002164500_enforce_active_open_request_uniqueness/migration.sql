-- Create partial unique index to enforce REQ-14 duplicate prevention at the DB level
CREATE UNIQUE INDEX "unique_active_member_catalog_req" 
ON "EngagementRequest" ("memberId", "catalogItemId") 
WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'AWAITING_PAYMENT', 'PAYMENT_CONFIRMED');
