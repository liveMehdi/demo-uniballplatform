-- AlterTable
ALTER TABLE "BookingGuest" ADD COLUMN     "assignedTableId" TEXT;

-- CreateTable
CREATE TABLE "EventTable" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventTable_eventId_name_key" ON "EventTable"("eventId", "name");

-- CreateIndex
CREATE INDEX "BookingGuest_assignedTableId_idx" ON "BookingGuest"("assignedTableId");

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_assignedTableId_fkey" FOREIGN KEY ("assignedTableId") REFERENCES "EventTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTable" ADD CONSTRAINT "EventTable_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
