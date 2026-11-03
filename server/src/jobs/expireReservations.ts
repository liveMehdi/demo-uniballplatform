import { boss } from "../lib/jobs.js";
import { expirePendingBookings } from "../modules/bookings/bookings.service.js";

const QUEUE = "expire-reservations";

export async function registerReservationExpiry() {
  await boss.createQueue(QUEUE, {
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
  });

  await boss.work(QUEUE, async () => {
    const result = await expirePendingBookings();

    if (result.count > 0) {
      console.log(`Expired ${result.count} reservation(s).`);
    }
  });

  await boss.schedule(QUEUE, "* * * * *");

  await boss.send(QUEUE, {});
}
