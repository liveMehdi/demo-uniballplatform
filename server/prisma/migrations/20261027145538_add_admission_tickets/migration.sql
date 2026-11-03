-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guestId_key" ON "Ticket"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_token_key" ON "Ticket"("token");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "BookingGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
