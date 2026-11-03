import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import { enqueueCancellationEmails } from "../notifications/emailQueue.js";

export async function cancelEvent(eventId: string, userId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              cancelledAt: true,
            },
          });

          if (!event) {
            return {
              status: "not_found",
              error: "Event not found.",
            } as const;
          }

          const membership = await tx.membership.findUnique({
            where: {
              userId_societyId: {
                userId,
                societyId: event.societyId,
              },
            },
            select: { role: true },
          });

          if (membership?.role !== "ORGANISER") {
            return {
              status: "forbidden",
              error: "You cannot cancel this event.",
            } as const;
          }

          await lockOrganiserAccess(tx, event.societyId, userId);
          if (event.cancelledAt) {
            return {
              status: "cancelled",
              cancelledAt: event.cancelledAt,
            } as const;
          }
          const affectedBookings = await tx.booking.findMany({
            where: {
              eventId,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { id: true },
          });
          const now = new Date();

          await tx.event.update({
            where: { id: eventId },
            data: {
              cancelledAt: now,
              salesClosed: true,
              seatingPublishedAt: null,
            },
          });

          await tx.booking.updateMany({
            where: {
              eventId,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            data: {
              status: "CANCELLED",
            },
          });

          await tx.ticket.updateMany({
            where: {
              revokedAt: null,
              guest: {
                bookingItem: {
                  booking: { eventId },
                },
              },
            },
            data: {
              revokedAt: now,
            },
          });
          await enqueueCancellationEmails(
            tx,
            affectedBookings.map((booking) => booking.id),
          );
          return {
            status: "cancelled",
            cancelledAt: now,
          } as const;
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
          error: "The event changed during cancellation. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of event cancellation retry loop.");
}
