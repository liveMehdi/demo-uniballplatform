import { prisma } from "../lib/prisma.js";

const email = process.argv[2];

if (!email) {
  throw new Error(
    "Provide your registered email: npm run setup:society -- you@example.com",
  );
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("No user found with that email. Register first.");
  }

  const society = await prisma.$transaction(async (tx) => {
    const society = await tx.society.upsert({
      where: { id: "development-society" },
      update: {},
      create: {
        id: "development-society",
        name: "University Events Society",
      },
    });

    await tx.membership.upsert({
      where: {
        userId_societyId: {
          userId: user.id,
          societyId: society.id,
        },
      },
      update: {
        role: "ORGANISER",
      },
      create: {
        userId: user.id,
        societyId: society.id,
        role: "ORGANISER",
      },
    });

    return society;
  });

  console.log(`Society: ${society.name}`);
  console.log(`Organiser: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
