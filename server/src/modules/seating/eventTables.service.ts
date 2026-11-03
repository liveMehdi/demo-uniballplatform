import { hasEventFinished } from "../../lib/eventLifecycle.js";
import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import {
  assertEventNotCancelled,
  writeToActiveEvent,
} from "../../lib/eventWriteGuard.js";

async function checkEventAccess(
  eventId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      societyId: true,
      startsAt: true,
      seatingPublishedAt: true,
      cancelledAt: true,
    },
  });

  if (!event) {
    return {
      status: "not_found",
    } as const;
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_societyId: {
        userId,
        societyId: event.societyId,
      },
    },
    select: {
      role: true,
    },
  });

  if (membership?.role !== "ORGANISER") {
    return {
      status: "forbidden",
    } as const;
  }

  return {
    status: "allowed",
    event,
  } as const;
}

export async function createEventTable(
  eventId: string,
  userId: string,
  input: { name: string; capacity: number },
) {
  return writeToActiveEvent(eventId, async (tx) => {
    const access = await checkEventAccess(eventId, userId, tx);

    if (access.status !== "allowed") return access;

    await lockOrganiserAccess(tx, access.event.societyId, userId);

    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
    if (access.event.seatingPublishedAt) return { status: "conflict", error: "Unpublish seating before adding tables." } as const;
    const table = await tx.eventTable.create({
      data: {
        eventId,
        name: input.name,
        capacity: input.capacity,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
      },
    });

    return { status: "created", table } as const;
  }, { beforeStart: true });
}

export async function listEventTables(eventId: string, userId: string) {
  const access = await checkEventAccess(eventId, userId);

  if (access.status !== "allowed") return access;

  const tables = await prisma.eventTable.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      capacity: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return {
    status: "found",
    event: {
      id: access.event.id,
      title: access.event.title,
    },
    tables,
  } as const;
}

export async function assignGuestTable(
  eventId: string,
  guestId: string,
  userId: string,
  tableId: string | null,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              startsAt: true,
              seatingPublishedAt: true,
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
              error: "You cannot manage seating for this event.",
            } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          await assertEventNotCancelled(tx, eventId);
          const now = new Date();

          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
          if (event.seatingPublishedAt) {
            return { status: "conflict", error: "Unpublish seating before making changes, then publish the completed plan again." } as const;
          }
          if (hasEventFinished(event.startsAt, now.getTime())) {
            return {
              status: "conflict",
              error: "Seating cannot be changed after the event finishes.",
            } as const;
          }

          const guest = await tx.bookingGuest.findFirst({
            where: {
              id: guestId,
              bookingItem: {
                booking: { eventId },
              },
            },
            select: {
              id: true,
              assignedTableId: true,
              bookingItem: {
                select: {
                  booking: {
                    select: {
                      status: true,
                      expiresAt: true,
                    },
                  },
                },
              },
            },
          });

          if (!guest) {
            return {
              status: "not_found",
              error: "Guest not found for this event.",
            } as const;
          }

          // clearing an assignment is also allowed for inactive bookings
          if (tableId === null) {
            const updated = await tx.bookingGuest.update({
              where: { id: guest.id },
              data: { assignedTableId: null },
              select: {
                id: true,
                assignedTableId: true,
              },
            });

            return {
              status: "updated",
              guest: updated,
            } as const;
          }

          const booking = guest.bookingItem.booking;

          const hasActiveBooking =
            booking.status === "CONFIRMED" ||
            (booking.status === "PENDING" && booking.expiresAt > now);

          if (!hasActiveBooking) {
            return {
              status: "conflict",
              error: "Only guests with active bookings can be assigned.",
            } as const;
          }

          const table = await tx.eventTable.findFirst({
            where: {
              id: tableId,
              eventId,
            },
            select: {
              id: true,
              capacity: true,
            },
          });

          if (!table) {
            return {
              status: "not_found",
              error: "Table not found for this event.",
            } as const;
          }

          // repeating an existing assignment succeeds without taking a seat
          if (guest.assignedTableId === table.id) {
            return {
              status: "updated",
              guest: {
                id: guest.id,
                assignedTableId: table.id,
              },
            } as const;
          }

          const occupiedSeats = await tx.bookingGuest.count({
            where: {
              assignedTableId: table.id,
              bookingItem: {
                booking: {
                  eventId,
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

          if (occupiedSeats >= table.capacity) {
            return {
              status: "conflict",
              error: "This table is full.",
            } as const;
          }

          const updated = await tx.bookingGuest.update({
            where: { id: guest.id },
            data: { assignedTableId: table.id },
            select: {
              id: true,
              assignedTableId: true,
            },
          });

          return {
            status: "updated",
            guest: updated,
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
          error: "Seating changed during this request. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of seating assignment retry loop.");
}

export async function getSeatingOverview(eventId: string, userId: string) {
  const access = await checkEventAccess(eventId, userId);

  if (access.status !== "allowed") return access;

  const now = new Date();

  const [tables, guests] = await prisma.$transaction(
    [
      prisma.eventTable.findMany({
        where: { eventId },
        select: {
          id: true,
          name: true,
          capacity: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.bookingGuest.findMany({
        where: {
          bookingItem: {
            booking: {
              eventId,
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
        select: {
          id: true,
          fullName: true,
          position: true,
          assignedTableId: true,
          tableGroup: {
            select: {
              id: true,
              name: true,
            },
          },
          bookingItem: {
            select: {
              bookingId: true,
              ticketType: {
                select: { tier: true },
              },
              booking: {
                select: { status: true },
              },
            },
          },
        },
        orderBy: [{ bookingItemId: "asc" }, { position: "asc" }],
      }),
    ],
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    },
  );

  const occupancy = new Map<string, number>();

  for (const guest of guests) {
    if (guest.assignedTableId) {
      occupancy.set(
        guest.assignedTableId,
        (occupancy.get(guest.assignedTableId) ?? 0) + 1,
      );
    }
  }

  return {
    status: "found",
    event: {
      id: access.event.id,
      title: access.event.title,
      startsAt: access.event.startsAt,
      seatingPublishedAt: access.event.seatingPublishedAt,
      cancelledAt: access.event.cancelledAt,
    },
    tables: tables.map((table) => ({
      ...table,
      occupiedSeats: occupancy.get(table.id) ?? 0,
    })),
    guests: guests.map((guest) => ({
      id: guest.id,
      fullName: guest.fullName,
      position: guest.position,
      assignedTableId: guest.assignedTableId,
      tableGroup: guest.tableGroup,
      bookingId: guest.bookingItem.bookingId,
      bookingStatus: guest.bookingItem.booking.status,
      tier: guest.bookingItem.ticketType.tier,
    })),
  } as const;
}

export async function assignGroupTable(
  eventId: string,
  groupId: string,
  userId: string,
  tableId: string | null,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              startsAt: true,
              seatingPublishedAt: true,
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
              error: "You cannot manage seating for this event.",
            } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          await assertEventNotCancelled(tx, eventId);

          const now = new Date();

          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
          if (event.seatingPublishedAt) {
            return { status: "conflict", error: "Unpublish seating before making changes, then publish the completed plan again." } as const;
          }
          if (hasEventFinished(event.startsAt, now.getTime())) {
            return {
              status: "conflict",
              error: "Seating cannot be changed after the event finishes.",
            } as const;
          }

          const group = await tx.tableGroup.findFirst({
            where: {
              id: groupId,
              eventId,
            },
            select: { id: true },
          });

          if (!group) {
            return {
              status: "not_found",
              error: "Seating group not found for this event.",
            } as const;
          }

          const guests = await tx.bookingGuest.findMany({
            where: {
              tableGroupId: group.id,
              bookingItem: {
                booking: {
                  eventId,
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
            select: { id: true },
          });

          if (guests.length === 0) {
            return {
              status: "conflict",
              error: "This group has no active guests to move.",
            } as const;
          }

          const guestIds = guests.map((guest) => guest.id);

          if (tableId !== null) {
            const table = await tx.eventTable.findFirst({
              where: {
                id: tableId,
                eventId,
              },
              select: {
                id: true,
                capacity: true,
              },
            });

            if (!table) {
              return {
                status: "not_found",
                error: "Table not found for this event.",
              } as const;
            }

            // ex1clude this groups guests already at the destination
            const otherOccupiedSeats = await tx.bookingGuest.count({
              where: {
                assignedTableId: table.id,
                id: { notIn: guestIds },
                bookingItem: {
                  booking: {
                    eventId,
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

            if (otherOccupiedSeats + guests.length > table.capacity) {
              return {
                status: "conflict",
                error: "This table does not have room for the whole group.",
              } as const;
            }
          }

          await tx.bookingGuest.updateMany({
            where: {
              id: { in: guestIds },
            },
            data: {
              assignedTableId: tableId,
            },
          });

          return {
            status: "updated",
            groupId: group.id,
            assignedTableId: tableId,
            guestCount: guests.length,
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
          error: "Seating changed during this request. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of group assignment retry loop.");
}

type TableChange =
  | {
      kind: "update";
      name: string;
      capacity: number;
    }
  | {
      kind: "delete";
    };

export async function changeEventTable(
  eventId: string,
  tableId: string,
  userId: string,
  change: TableChange,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              startsAt: true,
              seatingPublishedAt: true,
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
              error: "You cannot manage tables for this event.",
            } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          await assertEventNotCancelled(tx, eventId);
          const now = new Date();

          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
          if (event.seatingPublishedAt) {
            return { status: "conflict", error: "Unpublish seating before making changes, then publish the completed plan again." } as const;
          }
          if (hasEventFinished(event.startsAt, now.getTime())) {
            return {
              status: "conflict",
              error: "Tables cannot be changed after the event finishes.",
            } as const;
          }

          const table = await tx.eventTable.findFirst({
            where: {
              id: tableId,
              eventId,
            },
            select: { id: true },
          });

          if (!table) {
            return {
              status: "not_found",
              error: "Table not found for this event.",
            } as const;
          }

          const occupiedSeats = await tx.bookingGuest.count({
            where: {
              assignedTableId: table.id,
              bookingItem: {
                booking: {
                  eventId,
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

          if (change.kind === "delete") {
            if (occupiedSeats > 0) {
              return {
                status: "conflict",
                error:
                  "Move or unassign this table's active guests before deleting it.",
              } as const;
            }

            await tx.eventTable.delete({
              where: { id: table.id },
            });

            return {
              status: "deleted",
            } as const;
          }

          if (change.capacity < occupiedSeats) {
            return {
              status: "conflict",
              error: `This table has ${occupiedSeats} active guests. Move guests before reducing its capacity below that number.`,
            } as const;
          }

          const updated = await tx.eventTable.update({
            where: { id: table.id },
            data: {
              name: change.name,
              capacity: change.capacity,
            },
            select: {
              id: true,
              name: true,
              capacity: true,
            },
          });

          return {
            status: "updated",
            table: updated,
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
          error: "Seating changed during this request. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of table change retry loop.");
}

export async function setSeatingPublication(
  eventId: string,
  userId: string,
  published: boolean,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              seatingPublishedAt: true,
              startsAt: true,
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
              error: "You cannot publish seating for this event.",
            } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          await assertEventNotCancelled(tx, eventId);
          if (hasEventFinished(event.startsAt)) return { status: "conflict", error: "This event has finished." } as const;
          if (published) {
            const unassignedConfirmedGuests = await tx.bookingGuest.count({
              where: {
                assignedTableId: null,
                bookingItem: {
                  booking: {
                    eventId,
                    status: "CONFIRMED",
                  },
                },
              },
            });

            if (unassignedConfirmedGuests > 0) {
              return {
                status: "conflict",
                error: `Assign all confirmed guests before publishing. ${unassignedConfirmedGuests} still need a table.`,
              } as const;
            }
          }

          const updated = await tx.event.update({
            where: { id: eventId },
            data: {
              seatingPublishedAt: published
                ? (event.seatingPublishedAt ?? new Date())
                : null,
            },
            select: {
              id: true,
              seatingPublishedAt: true,
            },
          });

          return {
            status: "updated",
            event: updated,
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
          error: "Seating changed during this request. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of publication retry loop.");
}

export async function getBookingSeating(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      status: true,
      event: {
        select: {
          seatingPublishedAt: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          guests: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              fullName: true,
              position: true,
              assignedTable: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  if (booking.status !== "CONFIRMED") {
    return {
      visibility: "not_confirmed",
      guests: [],
    } as const;
  }

  if (!booking.event.seatingPublishedAt) {
    return {
      visibility: "hidden",
      guests: [],
    } as const;
  }

  return {
    visibility: "published",
    guests: booking.items.flatMap((item) =>
      item.guests.map((guest) => ({
        id: guest.id,
        fullName: guest.fullName,
        position: guest.position,
        tableName: guest.assignedTable?.name ?? null,
      })),
    ),
  } as const;
}
