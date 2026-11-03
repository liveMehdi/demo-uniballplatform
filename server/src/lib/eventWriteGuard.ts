import { prisma } from "./prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { isTransactionConflict } from "./transactionErrors.js";

export class EventWriteError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function assertEventNotCancelled(
  tx: Prisma.TransactionClient,
  eventId: string,
  options: { beforeStart?: boolean } = {},
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { cancelledAt: true, startsAt: true },
  });

  if (!event) {
    throw new EventWriteError(404, "Event not found.");
  }

  if (event.cancelledAt) {
    throw new EventWriteError(
      409,
      "This event has been cancelled and cannot be modified.",
    );
  }
  if (options.beforeStart && event.startsAt <= new Date()) {
    throw new EventWriteError(
      409,
      "This event has started and its setup cannot be changed.",
    );
  }
}

// used for writes that donot already have a transaction
export async function writeToActiveEvent<T>(
  eventId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { beforeStart?: boolean } = {},
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await assertEventNotCancelled(tx, eventId, options);
          return operation(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;

      if (attempt === 2) {
        throw new EventWriteError(
          503,
          "The event changed during this request. Please try again.",
        );
      }
    }
  }

  throw new Error("Unexpected end of event write retry loop.");
}
