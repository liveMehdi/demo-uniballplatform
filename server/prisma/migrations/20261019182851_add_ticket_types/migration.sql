-- CreateEnum
CREATE TYPE "TicketTier" AS ENUM ('STANDARD', 'VIP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER;

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tier" "TicketTier" NOT NULL,
    "pricePence" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "salesStart" TIMESTAMP(3) NOT NULL,
    "salesEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketType_eventId_tier_idx" ON "TicketType"("eventId", "tier");

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
