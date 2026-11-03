import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import { EventWriteError } from "../../lib/eventWriteGuard.js";
import { ensureGuestTicket } from "../tickets/bookingTickets.service.js";
import { enqueueTicketEmail } from "../notifications/emailQueue.js";
import { emailEnabled } from "../../lib/emailConfig.js";

export function confirmFreeBooking(bookingId: string, userId: string) {
  return confirmBooking(bookingId, userId, "free");
}

export function completeDemoCheckout(bookingId: string, userId: string) {
  return confirmBooking(bookingId, userId, "simulated");
}

// both paths use stored prices, demo checkout doesnt represent money received
async function confirmBooking(
  bookingId: string,
  userId: string,
  mode: "free" | "simulated",
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const booking = await tx.booking.findFirst({
            where: { id: bookingId, userId },
            include: {
              event: true,
              items: { include: { guests: { include: { mealOption: true } } } },
            },
          });
          if (!booking) throw new EventWriteError(404, "Booking not found.");
          if (booking.event.cancelledAt)
            throw new EventWriteError(409, "This event has been cancelled.");
          if (mode === "free" && booking.totalPence !== 0)
            throw new EventWriteError(
              409,
              "Use demo checkout to complete this booking. No money will be charged.",
            );
          if (booking.status === "CONFIRMED")
            return {
              status: "CONFIRMED",
              simulatedPaymentAt: booking.simulatedPaymentAt,
            } as const;
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${booking.eventId} FOR UPDATE`;
          const now = new Date();
          const cutoff =
            booking.event.cateringDeadline ?? booking.event.startsAt;
          if (
            booking.status !== "PENDING" ||
            booking.expiresAt <= now ||
            cutoff <= now ||
            !booking.event.publishedAt
          ) {
            throw new EventWriteError(
              409,
              "This reservation can no longer be confirmed.",
            );
          }
          const guests = booking.items.flatMap((item) => item.guests);
          if (
            !booking.items.length ||
            booking.items.some(
              (item) => item.guests.length !== item.quantity,
            ) ||
            guests.some(
              (guest) =>
                !guest.fullName?.trim() ||
                (booking.event.cateringDeadline &&
                  guest.mealOption?.eventId !== booking.eventId),
            )
          ) {
            throw new EventWriteError(
              409,
              "Save a name for every guest and a meal choice for each guest at catered events before confirming.",
            );
          }
          const simulatedPaymentAt =
            mode === "simulated" && booking.totalPence > 0 ? now : null;
          await tx.booking.update({
            where: { id: bookingId },
            data: {
              status: "CONFIRMED",
              simulatedPaymentAt,
              lastTicketEmailAt: emailEnabled() ? now : null,
            },
          });
          for (const guest of guests) await ensureGuestTicket(tx, guest.id);
          await enqueueTicketEmail(tx, bookingId);
          if (
            booking.event.seatingPublishedAt &&
            guests.some((guest) => !guest.assignedTableId)
          ) {
            await tx.event.update({
              where: { id: booking.eventId },
              data: { seatingPublishedAt: null },
            });
          }
          return { status: "CONFIRMED", simulatedPaymentAt } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        !isTransactionConflict(error) &&
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
      )
        throw error;
      if (attempt === 2)
        throw new EventWriteError(
          503,
          "The booking changed during confirmation. Please try again.",
        );
    }
  }
  throw new Error("Unexpected end of confirmation attempts.");
}
