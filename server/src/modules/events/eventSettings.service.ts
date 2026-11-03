import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";
import type { UpdateEventDetailsInput } from "./events.schema.js";

export type EventSettingsChange =
  | { kind: "publish" }
  | {
      kind: "details";
      input: UpdateEventDetailsInput;
    }
  | {
      kind: "sales";
      salesClosed: boolean;
    };

export async function changeEventSettings(
  eventId: string,
  userId: string,
  change: EventSettingsChange,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.event.findUnique({
            where: { id: eventId },
            select: {
              societyId: true,
              updatedAt: true,
              startsAt: true,
              cancelledAt: true,
              publishedAt: true,
              cateringDeadline: true,
              capacity: true,
              title: true,
              venue: true,
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
              error: "You cannot manage this event.",
            } as const;
          }
          await lockOrganiserAccess(tx, event.societyId, userId);
          if (event.cancelledAt) {
            return {
              status: "conflict",
              error: "Cancelled events cannot be edited or reopened.",
            } as const;
          }
          const now = new Date();

          if (event.startsAt <= now) {
            return {
              status: "conflict",
              error: "This event has already started.",
            } as const;
          }

          if (change.kind === "publish") {
            if (event.publishedAt) return { status: "updated" } as const;
            const cutoff = event.cateringDeadline ?? event.startsAt;
            const tiers = await tx.ticketType.findMany({ where: { eventId } });
            if (
              !event.title.trim() ||
              !event.venue.trim() ||
              !event.capacity ||
              cutoff <= now ||
              !tiers.length ||
              tiers.some(
                (t) =>
                  t.capacity <= 0 ||
                  t.capacity > event.capacity! ||
                  t.pricePence < 0 ||
                  t.salesStart >= t.salesEnd ||
                  t.salesEnd > cutoff,
              ) ||
              !tiers.some((t) => t.salesEnd > now)
            ) {
              return {
                status: "conflict",
                error:
                  "Complete the event details and add a valid ticket tier before publishing. Sales must end by the reservation deadline.",
              } as const;
            }
            if (
              event.cateringDeadline &&
              !(await tx.mealOption.findFirst({
                where: { eventId, isAvailable: true },
                select: { id: true },
              }))
            ) {
              return {
                status: "conflict",
                error:
                  "Add at least one available meal before publishing a catered event.",
              } as const;
            }
            await tx.event.update({
              where: { id: eventId },
              data: { publishedAt: now },
            });
            return { status: "updated" } as const;
          }

          if (change.kind === "sales") {
            await tx.event.update({
              where: { id: eventId },
              data: { salesClosed: change.salesClosed },
            });

            return { status: "updated" } as const;
          }

          const startsAt = new Date(change.input.startsAt);

          if (
            change.input.expectedUpdatedAt !== event.updatedAt.toISOString()
          ) {
            return {
              status: "conflict",
              error:
                "This event has changed. Reload the latest details before saving.",
            } as const;
          }

          if (startsAt <= now) {
            return {
              status: "conflict",
              error: "The event must start in the future.",
            } as const;
          }

          const cateringDeadline =
            change.input.cateringDeadline === undefined
              ? event.cateringDeadline
              : change.input.cateringDeadline === null
                ? null
                : new Date(change.input.cateringDeadline);
          const changedCatering =
            cateringDeadline?.getTime() !== event.cateringDeadline?.getTime();
          if (
            cateringDeadline &&
            (cateringDeadline > startsAt ||
              (changedCatering && cateringDeadline <= now))
          ) {
            return {
              status: "conflict",
              error:
                "The catering deadline must be in the future and no later than the event start.",
            } as const;
          }
          if (
            changedCatering &&
            event.cateringDeadline &&
            event.cateringDeadline <= now
          ) {
            return {
              status: "conflict",
              error: "The catering deadline has passed and cannot be reopened.",
            } as const;
          }
          if (
            Boolean(cateringDeadline) !== Boolean(event.cateringDeadline) &&
            (await tx.booking.findFirst({
              where: { eventId, status: { in: ["PENDING", "CONFIRMED"] } },
              select: { id: true },
            }))
          ) {
            return {
              status: "conflict",
              error:
                "Whether a meal is included cannot change while bookings exist.",
            } as const;
          }
          const cutoff = cateringDeadline ?? startsAt;
          const incompatibleTicketType = await tx.ticketType.findFirst({
            where: {
              eventId,
              salesEnd: { gt: cutoff },
            },
            select: { id: true },
          });

          if (incompatibleTicketType) {
            return {
              status: "conflict",
              error:
                "A ticket sale window ends after the proposed reservation deadline. Adjust that sale window first.",
            } as const;
          }

          await tx.event.update({
            where: { id: eventId },
            data: {
              title: change.input.title,
              description: change.input.description?.trim() || null,
              bannerUrl: change.input.bannerUrl,
              headingColor: change.input.headingColor,
              venue: change.input.venue,
              startsAt,
              cateringDeadline,
              updatedAt: new Date(
                Math.max(Date.now(), event.updatedAt.getTime() + 1),
              ),
            },
          });

          await tx.booking.updateMany({
            where: { eventId, status: "PENDING", expiresAt: { gt: cutoff } },
            data: { expiresAt: cutoff },
          });
          return { status: "updated" } as const;
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
          error: "The event changed during this request. Please try again.",
        } as const;
      }
    }
  }

  throw new Error("Unexpected end of event settings retry loop.");
}
