import { prisma } from "../lib/prisma.js";

async function main() {
  const items = await prisma.bookingItem.findMany({
    select: {
      id: true,
      quantity: true,
    },
  });

  let created = 0;

  for (const item of items) {
    const result = await prisma.bookingGuest.createMany({
      data: Array.from({ length: item.quantity }, (_, index) => ({
        bookingItemId: item.id,
        position: index + 1,
      })),
      skipDuplicates: true,
    });

    created += result.count;
  }

  console.log(`Created ${created} guest slots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
