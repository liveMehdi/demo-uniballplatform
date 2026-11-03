import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import type { UpdateTicketTypeInput } from "./ticketManagement.schema.js";
import { assertEventNotCancelled } from "../../lib/eventWriteGuard.js";

export class TicketManagementError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function runChange<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;

      if (attempt === 2) {
        throw new TicketManagementError(
          503,
          "The event changed during this request. Please try again.",
        );
      }
    }
  }

  throw new Error("Unexpected end of ticket management retry loop.");
}

async function getManagedEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      societyId: true,
      startsAt: true,
      cateringDeadline: true,
      capacity: true,
    },
  });

  if (!event) {
    throw new TicketManagementError(404, "Event not found.");
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
    throw new TicketManagementError(
      403,
      "You cannot manage tickets for this event.",
    );
  }

  await lockOrganiserAccess(tx, event.societyId, userId);
  return event;
}

export async function updateTicketType(
  eventId: string,
  ticketTypeId: string,
  userId: string,
  input: UpdateTicketTypeInput,
) {
  return runChange(async (tx) => {
    const event = await getManagedEvent(tx, eventId, userId);
    await assertEventNotCancelled(tx, eventId);

    if (event.startsAt <= new Date()) {
      throw new TicketManagementError(
        409,
        "Ticket types cannot be edited after the event starts.",
      );
    }

    const ticketType = await tx.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
      select: { id: true, updatedAt: true },
    });

    if (!ticketType) {
      throw new TicketManagementError(404, "Ticket type not found.");
    }

    if (input.expectedUpdatedAt !== ticketType.updatedAt.toISOString()) {
      throw new TicketManagementError(
        409,
        "This ticket type has changed. Reload the latest details before saving.",
      );
    }

    if (event.capacity === null || input.capacity > event.capacity) {
      throw new TicketManagementError(
        409,
        "Ticket capacity must not exceed the event capacity.",
      );
    }

    const salesStart = new Date(input.salesStart);
    const salesEnd = new Date(input.salesEnd);

    if (salesEnd > (event.cateringDeadline ?? event.startsAt)) {
      throw new TicketManagementError(
        409,
        "Ticket sales must end by the catering deadline or event start.",
      );
    }

    // match booking creation, overdue prending reservations still count until the expiry worker changes their status
    const reserved = await tx.bookingItem.aggregate({
      where: {
        ticketTypeId,
        booking: {
          eventId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      },
      _sum: { quantity: true },
    });

    const reservedPlaces = reserved._sum.quantity ?? 0;

    if (input.capacity < reservedPlaces) {
      throw new TicketManagementError(
        409,
        `This tier has ${reservedPlaces} reserved places. Capacity cannot be lower.`,
      );
    }

    await tx.ticketType.update({
      where: { id: ticketType.id },
      data: {
        pricePence: input.pricePence,
        capacity: input.capacity,
        salesStart,
        salesEnd,
        updatedAt: new Date(
          Math.max(Date.now(), ticketType.updatedAt.getTime() + 1),
        ),
      },
    });
  });
}

export async function revokeAdmissionTicket(
  eventId: string,
  ticketId: string,
  userId: string,
) {
  return runChange(async (tx) => {
    await getManagedEvent(tx, eventId, userId);

    const ticket = await tx.ticket.findFirst({
      where: {
        id: ticketId,
        guest: {
          bookingItem: {
            booking: { eventId },
          },
        },
      },
      select: {
        id: true,
        revokedAt: true,
      },
    });

    if (!ticket) {
      throw new TicketManagementError(
        404,
        "Admission ticket not found for this event.",
      );
    }

    if (ticket.revokedAt) return;

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { revokedAt: new Date() },
    });
  });
}
