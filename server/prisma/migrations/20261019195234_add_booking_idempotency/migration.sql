/*
  Warnings:

  - A unique constraint covering the columns `[userId,requestKey]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `requestHash` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestKey` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "requestHash" TEXT NOT NULL,
ADD COLUMN     "requestKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_userId_requestKey_key" ON "Booking"("userId", "requestKey");
