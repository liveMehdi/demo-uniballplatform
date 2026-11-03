import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";

export async function ensureGuestTicket(
  tx: Prisma.TransactionClient,
  guestId: string,
) {
  return tx.ticket.upsert({
    where: { guestId },
    create: { guestId, token: randomBytes(32).toString("hex") },
    update: {},
    select: { id: true, revokedAt: true, checkedInAt: true },
  });
}

export async function issueBookingTickets(bookingId: string, userId: string) {
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
              id: true,
              status: true,
              event: {
                select: {
                  id: true,
                  title: true,
                  venue: true,
                  startsAt: true,
                  cancelledAt: true,
                },
              },
              items: {
                orderBy: { id: "asc" },
                select: {
                  quantity: true,
                  ticketType: {
                    select: { tier: true },
                  },
                  guests: {
                    orderBy: { position: "asc" },
                    select: {
                      id: true,
                      position: true,
                      fullName: true,
                    },
                  },
                },
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
              error: "Tickets are only available for confirmed bookings.",
            } as const;
          }

          const incompleteGuests =
            booking.items.length === 0 ||
            booking.items.some((item) => item.guests.length !== item.quantity);

          if (incompleteGuests) {
            return {
              status: "conflict",
              error: "Guest places are incomplete. Contact the organiser.",
            } as const;
          }

          const guestPlaces = booking.items.flatMap((item) =>
            item.guests.map((guest) => ({
              ...guest,
              tier: item.ticketType.tier,
            })),
          );

          // create missing tickets without replacing existing credentials
          for (const guest of guestPlaces) {
            await ensureGuestTicket(tx, guest.id);
          }

          const tickets = await tx.ticket.findMany({
            where: {
              guestId: {
                in: guestPlaces.map((guest) => guest.id),
              },
            },
            select: {
              id: true,
              guestId: true,
              token: true,
              revokedAt: true,
              checkedInAt: true,
            },
          });

          const ticketsByGuest = new Map(
            tickets.map((ticket) => [ticket.guestId, ticket]),
          );

          return {
            status: "ready",
            bookingId: booking.id,
            event: booking.event,
            tickets: guestPlaces.map((guest) => {
              const ticket = ticketsByGuest.get(guest.id);

              if (!ticket) {
                throw new Error("Ticket missing after issuance.");
              }

              return {
                id: ticket.id,
                guestId: guest.id,
                fullName: guest.fullName,
                position: guest.position,
                tier: guest.tier,
                token: ticket.revokedAt ? null : ticket.token,
                revokedAt: ticket.revokedAt,
                checkedInAt: ticket.checkedInAt,
              };
            }),
          } as const;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      const uniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (!isTransactionConflict(error) && !uniqueConflict) {
        throw error;
      }

      if (attempt === 2) {
        return {
          status: "busy",
          error: "Tickets could not be prepared. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of ticket issuance retry loop.");
}
