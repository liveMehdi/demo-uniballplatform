import type { Prisma } from "../generated/prisma/client.js";

export async function lockOrganiserAccess(
  tx: Prisma.TransactionClient,
  societyId: string,
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "societyId" = ${societyId} AND "userId" = ${userId}
    FOR SHARE`;
}

export async function lockDoorAccess(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
) {
  await tx.$queryRaw`SELECT "userId" FROM "EventScanAccess"
    WHERE "eventId" = ${eventId} AND "userId" = ${userId}
    FOR SHARE`;
}
