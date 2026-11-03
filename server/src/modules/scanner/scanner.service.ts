import {
  FINISHED_AFTER_MS,
  hasEventFinished,
} from "../../lib/eventLifecycle.js";
import { lockOrganiserAccess, lockDoorAccess } from "../../lib/accessLocks.js";
import { ensureGuestTicket } from "../tickets/bookingTickets.service.js";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  EventWriteError,
  writeToActiveEvent,
} from "../../lib/eventWriteGuard.js";

export async function canManageScanAccess(
  eventId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
  lockAccess = false,
) {
  const event = await db.event.findFirst({
    where: {
      id: eventId,
      society: {
        memberships: {
          some: {
            userId,
            role: "ORGANISER",
          },
        },
      },
    },
    select: { id: true, societyId: true },
  });

  if (event && lockAccess)
    await lockOrganiserAccess(db, event.societyId, userId);
  return event !== null;
}

export async function listScannerEvents(userId: string) {
  return prisma.event.findMany({
    where: {
      cancelledAt: null,
      publishedAt: { not: null },
      startsAt: { gt: new Date(Date.now() - FINISHED_AFTER_MS) },
      OR: [
        {
          society: {
            memberships: {
              some: {
                userId,
                role: "ORGANISER",
              },
            },
          },
        },
        {
          scanAccess: {
            some: { userId },
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      venue: true,
      startsAt: true,
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
}

export async function listEventScanStaff(eventId: string) {
  const entries = await prisma.eventScanAccess.findMany({
    where: { eventId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return entries.map((entry) => entry.user);
}

export async function addEventScanStaff(
  eventId: string,
  email: string,
  actorId: string,
) {
  return writeToActiveEvent(eventId, async (tx) => {
    if (!(await canManageScanAccess(eventId, actorId, tx, true))) {
      throw new EventWriteError(
        403,
        "You cannot manage scan access for this event.",
      );
    }
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) return false;

    await tx.eventScanAccess.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId: user.id,
        },
      },
      create: {
        eventId,
        userId: user.id,
      },
      update: {},
    });

    return true;
  });
}

export async function removeEventScanStaff(
  eventId: string,
  userId: string,
  actorId: string,
) {
  await writeToActiveEvent(eventId, async (tx) => {
    if (!(await canManageScanAccess(eventId, actorId, tx, true))) {
      throw new EventWriteError(
        403,
        "You cannot manage scan access for this event.",
      );
    }
    await tx.eventScanAccess.deleteMany({
      where: { eventId, userId },
    });
  });
}

export async function canScanEvent(
  eventId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
  lockAccess = false,
) {
  const event = await db.event.findFirst({
    where: {
      id: eventId,
      publishedAt: { not: null },
      OR: [
        {
          society: {
            memberships: {
              some: { userId, role: "ORGANISER" },
            },
          },
        },
        {
          // delegated access ends at cancellation or ten hours after the start
          cancelledAt: null,
          startsAt: { gt: new Date(Date.now() - FINISHED_AFTER_MS) },
          scanAccess: {
            some: { userId },
          },
        },
      ],
    },
    select: { id: true, societyId: true },
  });

  if (!event) return false;
  if (lockAccess) {
    const membership = await db.membership.findUnique({
      where: { userId_societyId: { userId, societyId: event.societyId } },
      select: { role: true },
    });
    if (membership?.role === "ORGANISER")
      await lockOrganiserAccess(db, event.societyId, userId);
    else await lockDoorAccess(db, eventId, userId);
  }
  return true;
}

export async function getEventAttendance(eventId: string) {
  const guests = await prisma.bookingGuest.findMany({
    where: {
      bookingItem: {
        booking: {
          eventId,
          status: "CONFIRMED",
        },
      },
    },
    select: {
      ticket: {
        select: { checkedInAt: true },
      },
    },
  });

  const checkedIn = guests.filter(
    (guest) =>
      guest.ticket?.checkedInAt !== null &&
      guest.ticket?.checkedInAt !== undefined,
  ).length;

  return {
    confirmedGuests: guests.length,
    checkedIn,
    remaining: guests.length - checkedIn,
  };
}

export async function searchEventGuests(eventId: string, search: string) {
  const guests = await prisma.bookingGuest.findMany({
    where: {
      bookingItem: {
        booking: {
          eventId,
          status: "CONFIRMED",
        },
      },
      OR: [
        {
          fullName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          bookingItem: { bookingId: search },
        },
        {
          ticket: {
            is: { id: search },
          },
        },
      ],
    },
    select: {
      id: true,
      fullName: true,
      position: true,
      bookingItem: {
        select: {
          bookingId: true,
          ticketType: {
            select: { tier: true },
          },
        },
      },
      ticket: {
        select: {
          id: true,
          revokedAt: true,
          checkedInAt: true,
        },
      },
    },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    take: 21,
  });

  return {
    hasMore: guests.length > 20,
    guests: guests.slice(0, 20).map((guest) => ({
      id: guest.id,
      fullName: guest.fullName,
      position: guest.position,
      bookingId: guest.bookingItem.bookingId,
      tier: guest.bookingItem.ticketType.tier,
      ticket: guest.ticket,
    })),
  };
}

export async function recoverGuestTicket(
  eventId: string,
  guestId: string,
  userId: string,
) {
  return writeToActiveEvent(eventId, async (tx) => {
    if (!(await canScanEvent(eventId, userId, tx, true)))
      throw new EventWriteError(
        403,
        "You cannot access check-in for this event.",
      );
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { startsAt: true },
    });
    if (hasEventFinished(event.startsAt))
      throw new EventWriteError(409, "This event has finished.");
    const guest = await tx.bookingGuest.findFirst({
      where: {
        id: guestId,
        bookingItem: { booking: { eventId, status: "CONFIRMED" } },
      },
      select: { id: true },
    });
    if (!guest)
      throw new EventWriteError(
        404,
        "Confirmed guest not found for this event.",
      );
    return ensureGuestTicket(tx, guest.id);
  });
}
