import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import type { CreateTicketTypeInput } from "./ticketTypes.schema.js";
import { assertEventNotCancelled } from "../../lib/eventWriteGuard.js";

export async function createTicketType(
  eventId: string,
  userId: string,
  data: CreateTicketTypeInput,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
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
          if (event.capacity === null || event.capacity <= 0) {
            return {
              status: "invalid",
              message: "Set a positive event capacity first.",
            } as const;
          }

          if (data.capacity > event.capacity) {
            return {
              status: "invalid",
              message: "Ticket-type capacity cannot exceed event capacity.",
            } as const;
          }

          if (
            new Date(data.salesEnd) > (event.cateringDeadline ?? event.startsAt)
          ) {
            return {
              status: "invalid",
              message:
                "Ticket sales must end by the catering deadline or event start.",
            } as const;
          }

          const ticketType = await tx.ticketType.create({
            data: {
              eventId,
              tier: data.tier,
              pricePence: data.pricePence,
              capacity: data.capacity,
              salesStart: new Date(data.salesStart),
              salesEnd: new Date(data.salesEnd),
            },
          });

          return { status: "created", ticketType } as const;
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

  throw new Error("Unexpected end of ticket-type creation attempts");
}
