import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import { EventWriteError } from "../../lib/eventWriteGuard.js";
import { createHash } from "node:crypto";
import {
  createBookingSchema,
  type CreateBookingInput,
} from "./bookings.schema.js";

export async function createBooking(
  eventId: string,
  userId: string,
  input: CreateBookingInput,
) {
  const { items, requestKey } = createBookingSchema.parse(input);

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        eventId,
        items: [...items].sort((a, b) =>
          a.ticketTypeId.localeCompare(b.ticketTypeId),
        ),
      }),
    )
    .digest("hex");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.booking.findUnique({
            where: {
              userId_requestKey: {
                userId,
                requestKey,
              },
            },
            include: {
              items: true,
            },
          });

          if (existing) {
            if (existing.requestHash !== requestHash) {
              return {
                status: "conflict",
                message:
                  "This request key was already used for different details.",
              } as const;
            }

            return {
              status: "replayed",
              booking: existing,
            } as const;
          }
          const now = new Date();

          const event = await tx.event.findUnique({
            where: { id: eventId },
          });

          if (!event || !event.publishedAt) {
            return { status: "not_found" } as const;
          }
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
          const cutoff = event.cateringDeadline ?? event.startsAt;
          if (cutoff <= now)
            return {
              status: "unavailable",
              message: "The reservation deadline has passed.",
            } as const;
          const pending = await tx.booking.findFirst({
            where: {
              eventId,
              userId,
              status: "PENDING",
              expiresAt: { gt: now },
            },
            select: { id: true },
          });
          if (pending)
            return {
              status: "unavailable",
              message:
                "You already have an active reservation for this event. Complete or cancel it in My bookings first.",
            } as const;
          if (
            event.cateringDeadline &&
            !(await tx.mealOption.findFirst({
              where: { eventId, isAvailable: true },
              select: { id: true },
            }))
          ) {
            return {
              status: "unavailable",
              message: "Meal choices are not available for this event yet.",
            } as const;
          }
          if (event.cancelledAt) {
            return {
              status: "unavailable",
              message: "This event has been cancelled.",
            } as const;
          }
          if (event.salesClosed) {
            return {
              status: "unavailable",
              message: "Sales are closed for this event.",
            } as const;
          }

          if (
            event.capacity === null ||
            event.capacity <= 0 ||
            event.startsAt <= now
          ) {
            return {
              status: "unavailable",
              message: "This event is not accepting bookings.",
            } as const;
          }

          const ticketTypes = await tx.ticketType.findMany({
            where: {
              eventId,
              id: {
                in: items.map((item) => item.ticketTypeId),
              },
            },
          });

          if (ticketTypes.length !== items.length) {
            return {
              status: "invalid",
              message: "One or more ticket types do not belong to this event.",
            } as const;
          }

          const usedByType = await tx.bookingItem.groupBy({
            by: ["ticketTypeId"],
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

          const usedTotal = usedByType.reduce(
            (total, row) => total + (row._sum.quantity ?? 0),
            0,
          );

          const requestedTotal = items.reduce(
            (total, item) => total + item.quantity,
            0,
          );

          if (usedTotal + requestedTotal > event.capacity) {
            return {
              status: "unavailable",
              message: "Not enough places remain for this booking.",
            } as const;
          }

          const bookingItems: {
            ticketTypeId: string;
            quantity: number;
            unitPricePence: number;
          }[] = [];

          for (const item of items) {
            const ticketType = ticketTypes.find(
              (type) => type.id === item.ticketTypeId,
            );

            if (!ticketType) {
              throw new Error("Ticket type missing after validation");
            }

            if (now < ticketType.salesStart || now >= ticketType.salesEnd) {
              return {
                status: "unavailable",
                message: `${ticketType.tier} ticket sales are not open.`,
              } as const;
            }

            const used =
              usedByType.find((row) => row.ticketTypeId === ticketType.id)?._sum
                .quantity ?? 0;

            if (used + item.quantity > ticketType.capacity) {
              return {
                status: "unavailable",
                message: `Not enough ${ticketType.tier} tickets remain.`,
              } as const;
            }

            bookingItems.push({
              ticketTypeId: ticketType.id,
              quantity: item.quantity,
              unitPricePence: ticketType.pricePence,
            });
          }

          const totalPence = bookingItems.reduce(
            (total, item) => total + item.quantity * item.unitPricePence,
            0,
          );

          if (totalPence > 2147483647) {
            return {
              status: "invalid",
              message: "Booking total exceeds the supported amount.",
            } as const;
          }

          const booking = await tx.booking.create({
            data: {
              userId,
              eventId,
              totalPence,
              status: "PENDING",
              expiresAt: new Date(
                Math.min(now.getTime() + 30 * 60 * 1000, cutoff.getTime()),
              ),
              items: {
                create: bookingItems.map((item) => ({
                  ...item,
                  guests: {
                    create: Array.from(
                      { length: item.quantity },
                      (_, index) => ({
                        position: index + 1,
                      }),
                    ),
                  },
                })),
              },
              requestKey,
              requestHash,
            },
            include: {
              items: true,
            },
          });

          return { status: "created", booking } as const;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      const uniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      const retryable = uniqueConflict || isTransactionConflict(error);

      if (!retryable) throw error;

      if (attempt === 3) {
        return {
          status: "busy",
          message: "Booking is busy. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of booking attempts");
}

export async function listMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalPence: true,
      simulatedPaymentAt: true,
      expiresAt: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPricePence: true,
          ticketType: {
            select: {
              tier: true,
            },
          },
        },
      },
    },
  });
}

export async function expirePendingBookings() {
  return prisma.booking.updateMany({
    where: {
      status: "PENDING",
      expiresAt: {
        lte: new Date(),
      },
    },
    data: {
      status: "EXPIRED",
    },
  });
}

export async function cancelBooking(bookingId: string, userId: string) {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "CANCELLED",
    },
  });

  if (result.count === 1) {
    return { status: "cancelled" } as const;
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      status: true,
    },
  });

  if (!booking) {
    return { status: "not_found" } as const;
  }

  if (booking.status === "CANCELLED") {
    return { status: "cancelled" } as const;
  }

  return { status: "not_cancellable" } as const;
}

export async function listEventBookings(
  eventId: string,
  userId: string,
  page: number,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      societyId: true,
    },
  });

  if (!event) {
    return { status: "not_found" } as const;
  }

  const membership = await prisma.membership.findUnique({
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

  const pageSize = 20;

  const bookings = await prisma.booking.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      status: true,
      totalPence: true,
      simulatedPaymentAt: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          ticketType: {
            select: {
              tier: true,
            },
          },
        },
      },
    },
  });

  return {
    status: "ok",
    data: {
      event: {
        id: event.id,
        title: event.title,
      },
      bookings: bookings.slice(0, pageSize),
      page,
      hasMore: bookings.length > pageSize,
    },
  } as const;
}

export async function getBookingGuests(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      id: true,
      status: true,
      totalPence: true,
      simulatedPaymentAt: true,
      expiresAt: true,
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          cancelledAt: true,
          cateringDeadline: true,

          mealOptions: {
            where: { isAvailable: true },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPricePence: true,
          ticketType: {
            select: {
              tier: true,
            },
          },
          guests: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              fullName: true,
              updatedAt: true,
              dietaryRequirements: true,
              accessibilityNeeds: true,

              mealOptionId: true,
              mealOption: {
                select: {
                  id: true,
                  name: true,
                  isAvailable: true,
                },
              },
              tableGroup: {
                select: {
                  id: true,
                  name: true,
                  inviteCode: true,
                  maxSize: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  const now = new Date();

  const canEdit =
    !booking.event.cancelledAt &&
    booking.event.startsAt > now &&
    (booking.status === "CONFIRMED" ||
      (booking.status === "PENDING" && booking.expiresAt > now));

  return {
    ...booking,
    canEdit,
    canEditCatering:
      canEdit &&
      (!booking.event.cateringDeadline || booking.event.cateringDeadline > now),
  };
}

type GuestDetailsInput = {
  expectedUpdatedAt: string;
  fullName: string;
  dietaryRequirements: string | null;
  accessibilityNeeds: string | null;
  mealOptionId: string | null;
};

export async function updateBookingGuest(
  bookingId: string,
  guestId: string,
  userId: string,
  data: GuestDetailsInput,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingGuest = await tx.bookingGuest.findFirst({
            where: {
              id: guestId,
              bookingItem: {
                bookingId,
                booking: { userId },
              },
            },
            select: {
              updatedAt: true,
              mealOptionId: true,
              dietaryRequirements: true,
              bookingItem: {
                select: {
                  booking: {
                    select: {
                      eventId: true,
                      status: true,
                      event: { select: { cateringDeadline: true } },
                    },
                  },
                },
              },
            },
          });

          if (!existingGuest) {
            return { status: "not_found" } as const;
          }

          const booking = existingGuest.bookingItem.booking;
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${booking.eventId} FOR SHARE`;
          if (
            booking.event.cateringDeadline &&
            booking.event.cateringDeadline <= new Date() &&
            (data.mealOptionId !== existingGuest.mealOptionId ||
              data.dietaryRequirements !== existingGuest.dietaryRequirements)
          ) {
            return { status: "catering_locked" } as const;
          }
          if (
            !data.fullName.trim() ||
            (booking.status === "CONFIRMED" &&
              booking.event.cateringDeadline &&
              !data.mealOptionId)
          ) {
            return { status: "incomplete" } as const;
          }
          if (data.mealOptionId !== null) {
            // Serialise selection with retirement, without preventing unchanged retired choices.
            await tx.$queryRaw`SELECT "id" FROM "MealOption"
            WHERE "id" = ${data.mealOptionId}
              AND "eventId" = ${existingGuest.bookingItem.booking.eventId}
            FOR SHARE`;
            const meal = await tx.mealOption.findFirst({
              where: {
                id: data.mealOptionId,
                eventId: existingGuest.bookingItem.booking.eventId,
              },
              select: {
                id: true,
                isAvailable: true,
              },
            });

            const keepingExistingSelection =
              existingGuest.mealOptionId === data.mealOptionId;

            if (!meal || (!meal.isAvailable && !keepingExistingSelection)) {
              return { status: "invalid_meal" } as const;
            }
          }
          const now = new Date();

          if (
            data.expectedUpdatedAt !== existingGuest.updatedAt.toISOString()
          ) {
            return { status: "conflict" } as const;
          }
          const updatedAt = new Date(
            Math.max(now.getTime(), existingGuest.updatedAt.getTime() + 1),
          );

          const result = await tx.bookingGuest.updateMany({
            where: {
              id: guestId,
              bookingItem: {
                bookingId,
                booking: {
                  userId,
                  event: {
                    startsAt: { gt: now },
                    cancelledAt: null,
                  },
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
            data: {
              fullName: data.fullName,
              dietaryRequirements: data.dietaryRequirements,
              accessibilityNeeds: data.accessibilityNeeds,
              mealOptionId: data.mealOptionId,
              updatedAt,
            },
          });

          if (result.count === 1) {
            return { status: "updated", updatedAt } as const;
          }

          const guest = await tx.bookingGuest.findFirst({
            where: {
              id: guestId,
              bookingItem: {
                bookingId,
                booking: {
                  userId,
                },
              },
            },
            select: { id: true },
          });

          if (!guest) {
            return { status: "not_found" } as const;
          }

          return { status: "not_editable" } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt === 2) {
        throw new EventWriteError(
          503,
          "Guest details changed during this request. Please try again.",
        );
      }
    }
  }
  throw new Error("Unexpected end of guest update attempts.");
}

export async function listEventGuests(
  eventId: string,
  userId: string,
  status: "PENDING" | "CONFIRMED",
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      societyId: true,
    },
  });

  if (!event) {
    return { status: "not_found" } as const;
  }

  const membership = await prisma.membership.findUnique({
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

  const records = await prisma.bookingGuest.findMany({
    where: {
      bookingItem: {
        booking: {
          eventId,
          status,
          ...(status === "PENDING" ? { expiresAt: { gt: new Date() } } : {}),
        },
      },
    },
    orderBy: [{ bookingItemId: "asc" }, { position: "asc" }],
    select: {
      id: true,
      position: true,
      fullName: true,
      dietaryRequirements: true,
      accessibilityNeeds: true,
      bookingItem: {
        select: {
          bookingId: true,
          ticketType: {
            select: {
              tier: true,
            },
          },
        },
      },
      mealOption: {
        select: {
          id: true,
          name: true,
          isAvailable: true,
        },
      },
      tableGroup: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const guests = records.map((guest) => ({
    id: guest.id,
    bookingId: guest.bookingItem.bookingId,
    position: guest.position,
    tier: guest.bookingItem.ticketType.tier,
    fullName: guest.fullName,
    dietaryRequirements: guest.dietaryRequirements,
    accessibilityNeeds: guest.accessibilityNeeds,
    mealOption: guest.mealOption,
    tableGroup: guest.tableGroup,
  }));

  const mealCounts = new Map<
    string,
    { mealOptionId: string; name: string; count: number }
  >();

  for (const guest of guests) {
    if (!guest.mealOption) continue;

    const meal = guest.mealOption;
    const existing = mealCounts.get(meal.id);

    if (existing) {
      existing.count += 1;
    } else {
      mealCounts.set(meal.id, {
        mealOptionId: meal.id,
        name: meal.name,
        count: 1,
      });
    }
  }

  const meals = [...mealCounts.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    status: "ok",
    data: {
      event: {
        id: event.id,
        title: event.title,
      },
      bookingStatus: status,
      summary: {
        missingMealChoices: guests.filter((guest) => guest.mealOption === null)
          .length,
        meals,
        totalGuests: guests.length,
        namedGuests: guests.filter((guest) => Boolean(guest.fullName?.trim()))
          .length,
        missingNames: guests.filter((guest) => !guest.fullName?.trim()).length,
        dietaryRequests: guests.filter((guest) =>
          Boolean(guest.dietaryRequirements?.trim()),
        ).length,
        accessibilityRequests: guests.filter((guest) =>
          Boolean(guest.accessibilityNeeds?.trim()),
        ).length,
      },
      guests,
    },
  } as const;
}
