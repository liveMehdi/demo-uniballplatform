-- CreateTable
CREATE TABLE "EventScanAccess" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventScanAccess_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE INDEX "EventScanAccess_userId_idx" ON "EventScanAccess"("userId");

-- AddForeignKey
ALTER TABLE "EventScanAccess" ADD CONSTRAINT "EventScanAccess_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScanAccess" ADD CONSTRAINT "EventScanAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
