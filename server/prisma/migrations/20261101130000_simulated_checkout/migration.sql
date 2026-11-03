-- Records demo checkout only; existing bookings are not marked as paid or simulated.
ALTER TABLE "Booking" ADD COLUMN "simulatedPaymentAt" TIMESTAMP(3);
