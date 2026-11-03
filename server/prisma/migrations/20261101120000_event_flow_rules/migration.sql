ALTER TABLE "Event" ADD COLUMN "publishedAt" TIMESTAMP(3), ADD COLUMN "cateringDeadline" TIMESTAMP(3);
-- Preserve the visibility and catering cutoff of existing events.
UPDATE "Event" SET "publishedAt" = "createdAt";
UPDATE "Event" SET "cateringDeadline" = "startsAt"
WHERE EXISTS (SELECT 1 FROM "MealOption" WHERE "MealOption"."eventId" = "Event"."id");
-- Existing holds must not outlive the event. The worker still releases inventory.
UPDATE "Booking" b SET "expiresAt" = LEAST(b."expiresAt", e."startsAt")
FROM "Event" e WHERE b."eventId" = e."id" AND b."status" = 'PENDING';
CREATE INDEX "Booking_userId_eventId_status_expiresAt_idx" ON "Booking"("userId", "eventId", "status", "expiresAt");
