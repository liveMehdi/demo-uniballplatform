import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import { enqueueTicketEmail } from "./emailQueue.js";
import { emailEnabled } from "../../lib/emailConfig.js";

export async function requestTicketEmail(bookingId: string, userId: string) {
  if (!emailEnabled()) {
    return {
      status: "disabled",
      error: "Email is disabled for this demo.",
    } as const;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const booking = await tx.booking.findFirst({
            where: {
              id: bookingId,
              userId,
            },
            select: {
              status: true,
              lastTicketEmailAt: true,
              event: {
                select: { cancelledAt: true },
              },
            },
          });

          if (!booking) {
            return {
              status: "not_found",
              error: "Booking not found.",
            } as const;
          }

          if (booking.status !== "CONFIRMED" || booking.event.cancelledAt) {
            return {
              status: "conflict",
              error:
                "Ticket emails require a confirmed booking for an active event.",
            } as const;
          }

          const now = new Date();

          if (
            booking.lastTicketEmailAt &&
            now.getTime() - booking.lastTicketEmailAt.getTime() < 60_000
          ) {
            return {
              status: "limited",
              error: "Please wait one minute before requesting another email.",
            } as const;
          }

          await tx.booking.update({
            where: { id: bookingId },
            data: { lastTicketEmailAt: now },
          });

          await enqueueTicketEmail(tx, bookingId);

          return { status: "queued" } as const;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;

      if (attempt === 2) {
        return {
          status: "busy",
          error: "Could not queue the email. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of ticket email retry loop.");
}
