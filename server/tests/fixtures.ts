import "./environment.js";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";

export { prisma };

export const fixturePassword = "Test-password-123!";

export function createFixtures() {
  const userIds: string[] = [];
  const societyIds: string[] = [];

  async function event(
    organiserId: string,
    options: {
      capacity?: number;
      tierCapacity?: number;
      pricePence?: number;
      catered?: boolean;
    } = {},
  ) {
    const society = await prisma.society.create({
      data: {
        name: `Test society ${randomUUID()}`,
        memberships: { create: { userId: organiserId, role: "ORGANISER" } },
      },
    });

    societyIds.push(society.id);
    const now = Date.now();

    return prisma.event.create({
      data: {
        societyId: society.id,
        title: `Test ball ${randomUUID()}`,
        venue: "Test hall",
        startsAt: new Date(now + 2 * 86400_000),
        publishedAt: new Date(now - 60_000),
        cateringDeadline: options.catered ? new Date(now + 86400_000) : null,
        capacity: options.capacity ?? 10,
        ticketTypes: {
          create: ["STANDARD", "VIP"].map((tier) => ({
            tier: tier as "STANDARD" | "VIP",
            capacity: options.tierCapacity ?? options.capacity ?? 10,
            pricePence: options.pricePence ?? 0,
            salesStart: new Date(now - 60_000),
            salesEnd: new Date(now + 3600_000),
          })),
        },
        mealOptions: options.catered
          ? { create: { name: "Vegetarian" } }
          : undefined,
      },
      include: { ticketTypes: { orderBy: { tier: "asc" } }, mealOptions: true },
    });
  }

  async function user() {
    const id = randomUUID();

    const result = await prisma.user.create({
      data: {
        id,
        name: "Test organiser",
        email: `${id}@example.test`,
        emailVerified: true,
      },
    });

    userIds.push(id);

    return result;
  }

  async function cleanup() {
    // delete only data created by this suite
    const events = await prisma.event.findMany({
      where: { societyId: { in: societyIds } },
      select: { id: true },
    });

    const eventIds = events.map(({ id }) => id);

    await prisma.$transaction(async (tx) => {
      await tx.ticket.deleteMany({
        where: {
          guest: { bookingItem: { booking: { eventId: { in: eventIds } } } },
        },
      });

      await tx.booking.deleteMany({ where: { eventId: { in: eventIds } } });

      await tx.tableGroup.deleteMany({ where: { eventId: { in: eventIds } } });
      await tx.eventTable.deleteMany({ where: { eventId: { in: eventIds } } });
      await tx.mealOption.deleteMany({ where: { eventId: { in: eventIds } } });
      await tx.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });

      await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      await tx.society.deleteMany({ where: { id: { in: societyIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
  }

  return { event, user, userIds, cleanup };
}
