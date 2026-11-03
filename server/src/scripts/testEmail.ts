import "dotenv/config";
import { sendAppEmail } from "../lib/email.js";
import {
  buildTicketsEmail,
  buildEventCancelledEmail,
} from "../modules/notifications/emailTemplates.js";

async function main() {
  if (process.env.EMAIL_MODE !== "ethereal") {
    throw new Error("This test script requires EMAIL_MODE=ethereal.");
  }

  const bookingId = "00000000-0000-4000-8000-000000000001";

  const ticketsEmail = buildTicketsEmail({
    name: "Test Guest",
    eventTitle: "University Winter Ball",
    venue: "Great Hall",
    startsAt: new Date("2026-12-12T19:00:00.000Z"),
    bookingId,
  });

  await sendAppEmail({
    to: "test-guest@example.com",
    ...ticketsEmail,
  });

  const cancellationEmail = buildEventCancelledEmail({
    name: "Test Guest",
    eventTitle: "University Winter Ball",
    bookingId,
  });

  await sendAppEmail({
    to: "test-guest@example.com",
    ...cancellationEmail,
  });

  console.log("Both test emails were captured by Ethereal.");
}

main().catch(() => {
  console.error(
    "Ethereal smoke check failed. Check email configuration and network access.",
  );
  process.exitCode = 1;
});
