-- AlterTable
ALTER TABLE "BookingGuest" ADD COLUMN     "tableGroupId" TEXT;

-- CreateTable
CREATE TABLE "TableGroup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "maxSize" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableGroup_inviteCode_key" ON "TableGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "TableGroup_eventId_idx" ON "TableGroup"("eventId");

-- CreateIndex
CREATE INDEX "TableGroup_creatorId_idx" ON "TableGroup"("creatorId");

-- CreateIndex
CREATE INDEX "BookingGuest_tableGroupId_idx" ON "BookingGuest"("tableGroupId");

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_tableGroupId_fkey" FOREIGN KEY ("tableGroupId") REFERENCES "TableGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableGroup" ADD CONSTRAINT "TableGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableGroup" ADD CONSTRAINT "TableGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
