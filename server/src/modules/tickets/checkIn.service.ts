import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import { canScanEvent } from "../scanner/scanner.service.js";

export async function checkInTicket(
  eventId: string,
  userId: string,
  credential: string,
  lookupBy: "token" | "id" = "token",
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              cancelledAt: true,
            },
          });

          if (!event) {
            return {
              status: "not_found",
              error: "Event not found.",
            } as const;
          }

          if (!(await canScanEvent(eventId, userId, tx, true))) {
            return {
              status: "forbidden",
              error:
                "Check-in is unavailable or you no longer have access to this event.",
            } as const;
          }
          if (event.cancelledAt) {
            return {
              status: "invalid",
              error: "This event has been cancelled. Admission is closed.",
            } as const;
          }
          const ticket = await tx.ticket.findFirst({
            where: {
              ...(lookupBy === "token"
                ? { token: credential }
                : { id: credential }),
              guest: {
                bookingItem: {
                  booking: { eventId },
                },
              },
            },
            select: {
              id: true,
              revokedAt: true,
              checkedInAt: true,
              guest: {
                select: {
                  fullName: true,
                  position: true,
                  bookingItem: {
                    select: {
                      ticketType: {
                        select: { tier: true },
                      },
                      booking: {
                        select: { status: true },
                      },
                    },
                  },
                },
              },
            },
          });

          if (!ticket) {
            return {
              status: "invalid",
              error: "Ticket not found for this event.",
            } as const;
          }

          if (ticket.revokedAt) {
            return {
              status: "invalid",
              error: "This ticket has been revoked.",
            } as const;
          }

          if (ticket.guest.bookingItem.booking.status !== "CONFIRMED") {
            return {
              status: "invalid",
              error: "This ticket's booking is not confirmed.",
            } as const;
          }

          if (ticket.checkedInAt) {
            return {
              status: "already_checked_in",
              checkedInAt: ticket.checkedInAt,
              error: "This ticket has already been used.",
            } as const;
          }

          const checkedInAt = new Date();

          const updated = await tx.ticket.updateMany({
            where: {
              id: ticket.id,
              checkedInAt: null,
              revokedAt: null,
            },
            data: {
              checkedInAt,
            },
          });

          if (updated.count !== 1) {
            return {
              status: "conflict",
              error: "This ticket changed during check-in. Scan it again.",
            } as const;
          }

          return {
            status: "checked_in",
            ticket: {
              id: ticket.id,
              fullName: ticket.guest.fullName,
              position: ticket.guest.position,
              tier: ticket.guest.bookingItem.ticketType.tier,
              checkedInAt,
            },
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
          error: "Check-in is busy. Please scan again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of check-in retry loop.");
}
