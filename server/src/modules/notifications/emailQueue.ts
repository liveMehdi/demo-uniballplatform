import { fromPrisma } from "pg-boss";
import type { Prisma } from "../../generated/prisma/client.js";
import { boss } from "../../lib/jobs.js";
import { appOrigin, emailEnabled } from "../../lib/emailConfig.js";

export const EMAIL_QUEUE = "booking-emails";
export const AUTH_EMAIL_QUEUE = "auth-emails";
export const AUTH_EMAIL_LIFETIME = 3600;

export type AuthEmailJob = {
  kind: "password_reset" | "email_verification";
  userId: string;
  email: string;
  url: string;
  expiresAt: string;
};

export type BookingEmailJob = {
  kind: "tickets" | "event_cancelled";
  bookingId: string;
};

export async function createEmailQueue() {
  if (!emailEnabled()) return;
  await boss.createQueue(EMAIL_QUEUE, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  });
  await boss.createQueue(AUTH_EMAIL_QUEUE, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    retentionSeconds: AUTH_EMAIL_LIFETIME,
    deleteAfterSeconds: AUTH_EMAIL_LIFETIME,
  });
}

export async function enqueueAuthEmail(
  kind: AuthEmailJob["kind"],
  input: {
    user: { id: string; email: string };
    token: string;
    url: string;
  },
) {
  if (!emailEnabled()) return;
  const link = new URL(
    kind === "password_reset" ? "/reset-password" : "/verify-email",
    appOrigin(),
  );
  link.hash = new URLSearchParams({ token: input.token }).toString();
  // preserving the destination
  const callback = new URL(input.url).searchParams.get("callbackURL");
  if (callback) {
    const destination = new URL(callback, appOrigin());
    if (
      destination.origin === appOrigin() &&
      destination.searchParams.has("returnTo")
    ) {
      link.searchParams.set(
        "returnTo",
        destination.searchParams.get("returnTo")!,
      );
    }
  }
  await boss.send(AUTH_EMAIL_QUEUE, {
    kind,
    userId: input.user.id,
    email: input.user.email,
    url: link.toString(),
    expiresAt: new Date(Date.now() + AUTH_EMAIL_LIFETIME * 1000).toISOString(),
  } satisfies AuthEmailJob);
}

export async function enqueueTicketEmail(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  if (!emailEnabled()) return;
  await boss.send(
    EMAIL_QUEUE,
    {
      kind: "tickets",
      bookingId,
    } satisfies BookingEmailJob,
    {
      db: fromPrisma(tx),
    },
  );
}

export async function enqueueCancellationEmails(
  tx: Prisma.TransactionClient,
  bookingIds: string[],
) {
  if (!emailEnabled() || bookingIds.length === 0) return;

  await boss.insert(
    EMAIL_QUEUE,
    bookingIds.map((bookingId) => ({
      data: {
        kind: "event_cancelled",
        bookingId,
      } satisfies BookingEmailJob,
    })),
    {
      db: fromPrisma(tx),
    },
  );
}
