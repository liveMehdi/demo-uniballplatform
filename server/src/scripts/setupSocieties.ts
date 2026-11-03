import { prisma } from "../lib/prisma.js";

async function main() {
  const [emailArgument, ...societyArguments] = process.argv.slice(2);
  const email = emailArgument?.trim().toLowerCase();

  if (!email || societyArguments.length % 2 !== 0) {
    throw new Error(
      'Usage: node dist/scripts/setupSocieties.js registered@email.com [society-id "Society Name"] ...\nCreates the listed societies and grants this account organiser access to all existing societies.',
    );
  }

  const newSocieties: { id: string; name: string }[] = [];
  for (let index = 0; index < societyArguments.length; index += 2) {
    const id = societyArguments[index]!.trim();
    const name = societyArguments[index + 1]!.trim();
    if (!id || !name) {
      throw new Error("Society IDs and names must not be empty.");
    }
    if (newSocieties.some((society) => society.id === id)) {
      throw new Error(`Society ID supplied more than once: ${id}`);
    }
    newSocieties.push({ id, name });
  }

  const count = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error(
          "No user found with that email. Register on this app first.",
        );
      }

      for (const society of newSocieties) {
        await tx.society.upsert({
          where: { id: society.id },
          create: society,
          update: {},
        });
      }

      const societies = await tx.society.findMany({ select: { id: true } });
      for (const society of societies) {
        await tx.membership.upsert({
          where: {
            userId_societyId: { userId: user.id, societyId: society.id },
          },
          create: {
            userId: user.id,
            societyId: society.id,
            role: "ORGANISER",
          },
          update: { role: "ORGANISER" },
        });
      }
      return societies.length;
    },
    { timeout: 30_000 },
  );

  console.log(
    `Organiser access granted to all ${count} societies for ${email}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Society setup failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
