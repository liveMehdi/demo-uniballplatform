import { boss } from "../lib/jobs.js";
import { prisma } from "../lib/prisma.js";
import { sendAppEmail } from "../lib/email.js";
import { emailEnabled } from "../lib/emailConfig.js";
import {
  EMAIL_QUEUE,
  AUTH_EMAIL_QUEUE,
  createEmailQueue,
} from "../modules/notifications/emailQueue.js";
import type {
  BookingEmailJob,
  AuthEmailJob,
} from "../modules/notifications/emailQueue.js";
import {
  buildTicketsEmail,
  buildEventCancelledEmail,
  buildAuthEmail,
} from "../modules/notifications/emailTemplates.js";

export async function deliverEmailJob(
  data: BookingEmailJob | AuthEmailJob,
  send = sendAppEmail,
) {
  if (!emailEnabled()) return;
  if ("userId" in data) {
    if (new Date(data.expiresAt).getTime() <= Date.now()) return;
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true, emailVerified: true, name: true },
    });
    if (!user) throw new Error("Email recipient is not available yet.");
    if (
      user.email !== data.email ||
      (data.kind === "email_verification" && user.emailVerified)
    )
      return;
    if (data.kind === "password_reset") {
      const token = new URLSearchParams(new URL(data.url).hash.slice(1)).get(
        "token",
      );
      const verification = await prisma.verification.findFirst({
        where: {
          identifier: "reset-password:" + token,
          value: data.userId,
          expiresAt: { gt: new Date() },
        },
      });
      if (!verification) return;
    }
    await send({
      to: user.email,
      ...buildAuthEmail({ kind: data.kind, name: user.name, url: data.url }),
    });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      id: true,
      status: true,
      simulatedPaymentAt: true,
      user: { select: { name: true, email: true } },
      event: {
        select: { title: true, venue: true, startsAt: true, cancelledAt: true },
      },
    },
  });
  if (!booking) return;
  if (data.kind === "tickets") {
    if (booking.status !== "CONFIRMED" || booking.event.cancelledAt) return;
    await send({
      to: booking.user.email,
      ...buildTicketsEmail({
        name: booking.user.name,
        eventTitle: booking.event.title,
        venue: booking.event.venue,
        startsAt: booking.event.startsAt,
        bookingId: booking.id,
        simulated: Boolean(booking.simulatedPaymentAt),
      }),
    });
    return;
  }
  if (!booking.event.cancelledAt || booking.status !== "CANCELLED") return;
  await send({
    to: booking.user.email,
    ...buildEventCancelledEmail({
      name: booking.user.name,
      eventTitle: booking.event.title,
      bookingId: booking.id,
    }),
  });
}

export async function registerBookingEmailWorker(send = sendAppEmail) {
  if (!emailEnabled()) return;
  await createEmailQueue();
  for (const queue of [EMAIL_QUEUE, AUTH_EMAIL_QUEUE]) {
    await boss.work<BookingEmailJob | AuthEmailJob>(
      queue,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs) {
          try {
            await deliverEmailJob(job.data, send);
          } catch {
            console.error("Email delivery failed", { queue, jobId: job.id });
            throw new Error(
              "Email delivery failed. Check email configuration; inspect queue status for exhausted retries.",
            );
          }
        }
      },
    );
  }
}
