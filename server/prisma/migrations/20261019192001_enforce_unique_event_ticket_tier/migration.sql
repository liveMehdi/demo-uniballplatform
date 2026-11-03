/*
  Warnings:

  - A unique constraint covering the columns `[eventId,tier]` on the table `TicketType` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TicketType_eventId_tier_idx";

-- CreateIndex
CREATE UNIQUE INDEX "TicketType_eventId_tier_key" ON "TicketType"("eventId", "tier");
