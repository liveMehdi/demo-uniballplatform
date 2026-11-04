import "./environment.js";
import app from "../src/app.js";
import { boss } from "../src/lib/jobs.js";
import { prisma } from "../src/lib/prisma.js";
import { registerReservationExpiry } from "../src/jobs/expireReservations.js";

await boss.start();
await registerReservationExpiry();

const server = app.listen(4318, "127.0.0.1");
let stopping = false;

async function shutdown() {
  if (stopping) return;

  stopping = true;

  server.close();
  server.closeIdleConnections();

  await boss.stop();
  await prisma.$disconnect();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
