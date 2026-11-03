import { lockOrganiserAccess } from "../../lib/accessLocks.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { isTransactionConflict } from "../../lib/transactionErrors.js";

export class SocietyAccessError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

async function requireOrganiser(
  db: Prisma.TransactionClient,
  societyId: string,
  userId: string,
) {
  const membership = await db.membership.findUnique({
    where: { userId_societyId: { userId, societyId } },
  });
  if (membership?.role !== "ORGANISER") {
    throw new SocietyAccessError(403, "You must organise this society.");
  }
}

export async function listSocietyOrganisers(societyId: string, userId: string) {
  await requireOrganiser(prisma, societyId, userId);
  const memberships = await prisma.membership.findMany({
    where: { societyId, role: "ORGANISER" },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map(({ user }) => user);
}

export async function changeSocietyOrganiser(
  societyId: string,
  actorId: string,
  action: { kind: "add"; email: string } | { kind: "remove"; userId: string },
) {
  // auth and the last-organiser check share a tx
  // two organisers removing each other cant leave the society unmanaged
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Society" WHERE "id" = ${societyId} FOR UPDATE`;
          await requireOrganiser(tx, societyId, actorId);
          await lockOrganiserAccess(tx, societyId, actorId);
          if (action.kind === "add") {
            const user = await tx.user.findUnique({
              where: { email: action.email },
              select: { id: true },
            });
            if (!user) {
              throw new SocietyAccessError(
                404,
                "No registered account has this email.",
              );
            }
            await tx.membership.upsert({
              where: { userId_societyId: { userId: user.id, societyId } },
              create: { userId: user.id, societyId, role: "ORGANISER" },
              update: { role: "ORGANISER" },
            });
            return;
          }

          const target = await tx.membership.findUnique({
            where: { userId_societyId: { userId: action.userId, societyId } },
          });
          if (target?.role !== "ORGANISER") return;

          const count = await tx.membership.count({
            where: { societyId, role: "ORGANISER" },
          });
          if (count <= 1) {
            throw new SocietyAccessError(
              409,
              "Add another organiser before removing the last organiser.",
            );
          }
          await tx.membership.update({
            where: { id: target.id },
            data: { role: "MEMBER" },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return;
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt === 2) {
        throw new SocietyAccessError(
          503,
          "Society access changed during this request. Please try again.",
        );
      }
    }
  }
}

export async function listOrganisedSocieties(userId: string) {
  return prisma.society.findMany({
    where: {
      memberships: {
        some: {
          userId,
          role: "ORGANISER",
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}
