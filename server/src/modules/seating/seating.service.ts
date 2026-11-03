import { randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";

type GroupAction =
  | { kind: "create"; name: string }
  | { kind: "join"; inviteCode: string }
  | { kind: "leave" };

function failure(status: number, error: string) {
  return { status, body: { error } };
}

export async function changeGuestGroup(
  userId: string,
  guestId: string,
  action: GroupAction,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();

          const guest = await tx.bookingGuest.findFirst({
            where: {
              id: guestId,
              bookingItem: {
                booking: { userId },
              },
            },
            select: {
              id: true,
              tableGroupId: true,
              bookingItem: {
                select: {
                  booking: {
                    select: {
                      eventId: true,
                      status: true,
                      expiresAt: true,
                      event: {
                        select: {
                          startsAt: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          if (!guest) {
            return failure(404, "Guest not found.");
          }

          const booking = guest.bookingItem.booking;

          if (booking.event.startsAt <= now) {
            return failure(
              409,
              "Seating groups cannot be changed after the event starts.",
            );
          }

          // leaving is allowed even if the reservation expired
          if (action.kind === "leave") {
            await tx.bookingGuest.update({
              where: { id: guest.id },
              data: { tableGroupId: null },
            });

            return {
              status: 200,
              body: { group: null },
            };
          }

          const activeBooking =
            booking.status === "CONFIRMED" ||
            (booking.status === "PENDING" && booking.expiresAt > now);

          if (!activeBooking) {
            return failure(
              409,
              "An active reservation or confirmed booking is required.",
            );
          }

          let groupId: string;
          let responseStatus = 200;

          if (action.kind === "create") {
            if (guest.tableGroupId) {
              return failure(
                409,
                "This guest already belongs to a group. Leave it first.",
              );
            }

            const group = await tx.tableGroup.create({
              data: {
                eventId: booking.eventId,
                creatorId: userId,
                name: action.name,
                inviteCode: randomBytes(12).toString("hex"),
                maxSize: 10,
              },
              select: { id: true },
            });

            groupId = group.id;
            responseStatus = 201;
          } else {
            const group = await tx.tableGroup.findUnique({
              where: { inviteCode: action.inviteCode },
              select: {
                id: true,
                eventId: true,
                maxSize: true,
              },
            });

            if (!group || group.eventId !== booking.eventId) {
              return failure(
                404,
                "No matching group was found for this event.",
              );
            }

            if (guest.tableGroupId && guest.tableGroupId !== group.id) {
              return failure(
                409,
                "This guest already belongs to another group. Leave it first.",
              );
            }

            // rejoining the same group take another place
            if (guest.tableGroupId !== group.id) {
              const members = await tx.bookingGuest.count({
                where: {
                  tableGroupId: group.id,
                  bookingItem: {
                    booking: {
                      OR: [
                        { status: "CONFIRMED" },
                        {
                          status: "PENDING",
                          expiresAt: { gt: now },
                        },
                      ],
                    },
                  },
                },
              });

              if (members >= group.maxSize) {
                return failure(409, "This seating group is full.");
              }
            }

            groupId = group.id;
          }

          await tx.bookingGuest.update({
            where: { id: guest.id },
            data: { tableGroupId: groupId },
          });

          const group = await tx.tableGroup.findUniqueOrThrow({
            where: { id: groupId },
            select: {
              id: true,
              name: true,
              inviteCode: true,
              maxSize: true,
            },
          });

          return {
            status: responseStatus,
            body: { group },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;

      if (attempt === 3) {
        return failure(503, "Seating groups are busy. Please try again.");
      }
    }
  }

  throw new Error("Unexpected end of seating-group attempts");
}
