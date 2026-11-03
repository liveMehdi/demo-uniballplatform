import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateEventInput,
  CreateMealOptionInput,
  UpdateMealOptionInput,
} from "./events.schema.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import {
  assertEventNotCancelled,
  writeToActiveEvent,
  EventWriteError,
} from "../../lib/eventWriteGuard.js";

export async function listEvents() {
  return prisma.event.findMany({
    where: { publishedAt: { not: null } },
    orderBy: {
      startsAt: "asc",
    },
  });
}

export async function createEvent(data: CreateEventInput, userId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const membership = await tx.membership.findUnique({
            where: {
              userId_societyId: {
                userId,
                societyId: data.societyId,
              },
            },
          });

          if (!membership || membership.role !== "ORGANISER") {
            return null;
          }

          await lockOrganiserAccess(tx, data.societyId, userId);

          const startsAt = new Date(data.startsAt);
          if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) {
            throw new EventWriteError(
              400,
              "The event must start in the future.",
            );
          }

          const cateringDeadline = data.cateringDeadline
            ? new Date(data.cateringDeadline)
            : null;
          if (
            cateringDeadline &&
            (cateringDeadline <= new Date() || cateringDeadline > startsAt)
          ) {
            throw new EventWriteError(
              400,
              "The catering deadline must be in the future and no later than the event start.",
            );
          }
          return tx.event.create({
            data: {
              title: data.title,
              description: data.description,
              bannerUrl: data.bannerUrl,
              headingColor: data.headingColor,
              venue: data.venue,
              startsAt,
              cateringDeadline,
              societyId: data.societyId,
              capacity: data.capacity,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt === 2) {
        throw new EventWriteError(
          503,
          "Society access changed during this request. Please try again.",
        );
      }
    }
  }
  throw new Error("Unexpected end of event creation attempts.");
}

export async function findEventById(eventId: string, userId?: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { publishedAt: { not: null } },
        ...(userId
          ? [
              {
                society: {
                  memberships: { some: { userId, role: "ORGANISER" as const } },
                },
              },
            ]
          : []),
      ],
    },
    include: {
      ticketTypes: {
        select: {
          id: true,
          tier: true,
          pricePence: true,
          updatedAt: true,
          salesStart: true,
          salesEnd: true,
          capacity: true,
        },
        orderBy: {
          pricePence: "asc",
        },
      },

      mealOptions: {
        where: {
          isAvailable: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });
}

export async function listOrganiserEvents(userId: string) {
  const events = await prisma.event.findMany({
    where: {
      society: {
        memberships: {
          some: {
            userId,
            role: "ORGANISER",
          },
        },
      },
    },
    orderBy: {
      startsAt: "asc",
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      cancelledAt: true,
      publishedAt: true,
      capacity: true,
      society: {
        select: {
          name: true,
        },
      },
      bookings: {
        where: {
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
        select: {
          status: true,
          items: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  });

  return events.map((event) => {
    let pendingPlaces = 0;
    let confirmedPlaces = 0;

    for (const booking of event.bookings) {
      const quantity = booking.items.reduce(
        (total, item) => total + item.quantity,
        0,
      );

      if (booking.status === "PENDING") {
        pendingPlaces += quantity;
      } else {
        confirmedPlaces += quantity;
      }
    }

    const occupiedPlaces = pendingPlaces + confirmedPlaces;

    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      cancelledAt: event.cancelledAt,
      publishedAt: event.publishedAt,
      societyName: event.society.name,
      capacity: event.capacity,
      pendingPlaces,
      confirmedPlaces,
      remainingPlaces:
        event.capacity === null ? null : event.capacity - occupiedPlaces,
    };
  });
}

export async function updateEventCapacity(
  eventId: string,
  userId: string,
  capacity: number,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
            },
          });

          if (!event) {
            return { status: "not_found" } as const;
          }

          const membership = await tx.membership.findUnique({
            where: {
              userId_societyId: {
                userId,
                societyId: event.societyId,
              },
            },
          });

          if (!membership || membership.role !== "ORGANISER") {
            return { status: "forbidden" } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          await assertEventNotCancelled(tx, eventId, { beforeStart: true });

          const occupied = await tx.bookingItem.aggregate({
            where: {
              booking: {
                eventId,
                status: {
                  in: ["PENDING", "CONFIRMED"],
                },
              },
            },
            _sum: {
              quantity: true,
            },
          });

          const occupiedPlaces = occupied._sum.quantity ?? 0;

          if (capacity < occupiedPlaces) {
            return {
              status: "invalid",
              message:
                `Capacity cannot be below the ${occupiedPlaces} ` +
                "places currently reserved or confirmed.",
            } as const;
          }

          const ticketTypes = await tx.ticketType.aggregate({
            where: { eventId },
            _max: {
              capacity: true,
            },
          });

          const largestTierCapacity = ticketTypes._max.capacity ?? 0;

          if (capacity < largestTierCapacity) {
            return {
              status: "invalid",
              message:
                "Capacity cannot be below an existing ticket type's " +
                `capacity (${largestTierCapacity}).`,
            } as const;
          }

          const updated = await tx.event.update({
            where: { id: eventId },
            data: { capacity },
            select: {
              id: true,
              capacity: true,
            },
          });

          return { status: "updated", event: updated } as const;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;

      if (attempt === 3) {
        return { status: "busy" } as const;
      }
    }
  }

  throw new Error("Unexpected end of capacity update attempts");
}

export async function createMealOption(
  eventId: string,
  userId: string,
  input: CreateMealOptionInput,
) {
  return writeToActiveEvent(
    eventId,
    async (tx) => {
      const event = await requireMealManager(tx, eventId, userId);
      await lockOrganiserAccess(tx, event.societyId, userId);
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
      if (event.cateringDeadline && event.cateringDeadline <= new Date())
        throw new EventWriteError(
          409,
          "Catering is locked after the deadline.",
        );
      const mealOption = await tx.mealOption.create({
        data: {
          eventId,
          name: input.name,
          description: input.description || null,
        },
        select: { id: true, name: true, description: true, isAvailable: true },
      });
      return { status: "created", mealOption } as const;
    },
    { beforeStart: true },
  );
}

async function requireMealManager(
  db: Prisma.TransactionClient,
  eventId: string,
  userId: string,
) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { societyId: true, cateringDeadline: true },
  });

  if (!event) {
    throw new EventWriteError(404, "Event not found.");
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_societyId: {
        userId,
        societyId: event.societyId,
      },
    },
  });

  if (!membership || membership.role !== "ORGANISER") {
    throw new EventWriteError(403, "You must organise this event's society.");
  }
  return event;
}

export async function listMealOptions(eventId: string, userId: string) {
  await requireMealManager(prisma, eventId, userId);
  return prisma.mealOption.findMany({
    where: { eventId },
    select: { id: true, name: true, description: true, isAvailable: true },
    orderBy: [{ isAvailable: "desc" }, { name: "asc" }],
  });
}

export async function updateMealOption(
  eventId: string,
  mealOptionId: string,
  userId: string,
  input: UpdateMealOptionInput,
) {
  return writeToActiveEvent(
    eventId,
    async (tx) => {
      const event = await requireMealManager(tx, eventId, userId);
      await lockOrganiserAccess(tx, event.societyId, userId);
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
      if (event.cateringDeadline && event.cateringDeadline <= new Date())
        throw new EventWriteError(
          409,
          "Catering is locked after the deadline.",
        );
      const result = await tx.mealOption.updateMany({
        where: { id: mealOptionId, eventId },
        data: {
          name: input.name,
          description: input.description || null,
          isAvailable: input.isAvailable,
        },
      });
      if (!result.count)
        throw new EventWriteError(404, "Meal option not found for this event.");
    },
    { beforeStart: true },
  );
}
