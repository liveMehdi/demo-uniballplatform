import { boss } from "./lib/jobs.js";
import { prisma } from "./lib/prisma.js";
import { registerReservationExpiry } from "./jobs/expireReservations.js";
import { registerBookingEmailWorker } from "./jobs/bookingEmails.js";
import { validateEmailConfiguration } from "./lib/emailConfig.js";

let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;

  console.log("Stopping background worker...");

  try {
    await boss.stop();
  } finally {
    await prisma.$disconnect();
  }
}

process.once("SIGINT", () => {
  void shutdown().catch(() => {
    console.error("Worker shutdown failed.");
    process.exitCode = 1;
  });
});

process.once("SIGTERM", () => {
  void shutdown().catch(() => {
    console.error("Worker shutdown failed.");
    process.exitCode = 1;
  });
});

async function main() {
  validateEmailConfiguration();
  await boss.start();
  await registerBookingEmailWorker();
  await registerReservationExpiry();

  console.log("Background worker running");
}

main().catch(async () => {
  console.error(
    "Worker startup failed. Check database access and email configuration.",
  );
  process.exitCode = 1;
  await shutdown();
});
