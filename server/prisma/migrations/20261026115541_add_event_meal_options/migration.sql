-- AlterTable
ALTER TABLE "BookingGuest" ADD COLUMN     "mealOptionId" TEXT;

-- CreateTable
CREATE TABLE "MealOption" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealOption_eventId_name_key" ON "MealOption"("eventId", "name");

-- CreateIndex
CREATE INDEX "BookingGuest_mealOptionId_idx" ON "BookingGuest"("mealOptionId");

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "MealOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
