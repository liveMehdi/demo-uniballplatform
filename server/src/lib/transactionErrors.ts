import { Prisma } from "../generated/prisma/client.js";

export function isTransactionConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" ||
      (error.code === "P2010" &&
        (error.meta?.code === "40001" ||
          error.meta?.code === "40P01" ||
          isTransactionConflict(error.meta?.driverAdapterError))))
  ) {
    return true;
  }

  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false;
  }

  const cause = error.cause;

  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  return (
    ("originalCode" in cause &&
      (cause.originalCode === "40001" || cause.originalCode === "40P01")) ||
    ("kind" in cause && cause.kind === "TransactionWriteConflict")
  );
}
