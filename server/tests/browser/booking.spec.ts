import "../environment.js";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createFixtures, fixturePassword, prisma } from "../fixtures.js";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("demo button fills an existing organiser account and waits for sign in", async ({
  page,
  request,
}) => {
  const fixtures = createFixtures();
  const email = "demo-browser@example.test";

  try {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { name: "Demo organiser", email, password: fixturePassword },
    });
    expect(response.ok()).toBe(true);
    const { user } = await response.json();
    fixtures.userIds.push(user.id);
    await fixtures.event(user.id);

    await page.goto("/login");
    await expect(
      page.getByText("Changes are visible to everyone", { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

    await page
      .getByRole("button", { name: "Use demo admin account", exact: true })
      .click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      fixturePassword,
    );
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/events$/);

    const session = await page.request.get("/api/auth/get-session");
    expect((await session.json()).user.id).toBe(user.id);
  } finally {
    await fixtures.cleanup();
  }
});

test("attendee reserves, saves guest details, completes demo checkout and views a persistent QR ticket", async ({
  page,
}) => {
  const fixtures = createFixtures();
  const email = `${randomUUID()}@example.test`;

  try {
    const organiser = await fixtures.user();
    const event = await fixtures.event(organiser.id, {
      pricePence: 2500,
      catered: true,
    });

    // use the real app for each booking step
    await page.goto("/register");
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Browser attendee");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(fixturePassword);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/events$/);

    await page.goto(`/events/${event.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: event.title }),
    ).toBeVisible();
    await page
      .getByRole("spinbutton", { name: /Standard.*quantity/ })
      .fill("1");
    await page
      .getByRole("button", { name: "Reserve tickets", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Add guest details", exact: true })
      .click();

    await expect(page).toHaveURL(/\/bookings\/[^/]+\/guests$/);
    await expect(
      page.getByRole("button", { name: "Complete demo booking" }),
    ).toBeDisabled();

    await page
      .locator("summary")
      .filter({ hasText: "Name not provided" })
      .click();
    await page
      .getByRole("textbox", { name: "Full name", exact: true })
      .fill("Browser Guest");
    await page
      .getByRole("combobox", { name: "Meal choice" })
      .selectOption({ label: "Vegetarian" });
    await page.getByRole("button", { name: "Save guest", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Guest details saved." }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Complete demo booking", exact: true })
      .click();
    await page.getByRole("link", { name: "View tickets", exact: true }).click();
    await page
      .getByRole("button", { name: "Show tickets", exact: true })
      .click();

    const qr = page.locator("svg").filter({
      has: page.locator("title", {
        hasText: "Admission QR code for Browser Guest",
      }),
    });

    await expect(qr).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Browser Guest", exact: true }),
    ).toBeVisible();

    const saved = await prisma.booking.findFirstOrThrow({
      where: { eventId: event.id, user: { email } },
      include: {
        items: { include: { guests: { include: { ticket: true } } } },
      },
    });

    expect(saved.status).toBe("CONFIRMED");
    expect(saved.totalPence).toBe(2500);
    expect(saved.simulatedPaymentAt).not.toBeNull();

    const guest = saved.items[0]!.guests[0]!;

    expect(guest.fullName).toBe("Browser Guest");
    expect(guest.mealOptionId).toBe(event.mealOptions[0]!.id);
    expect(guest.ticket?.token).toMatch(/^[a-f0-9]{64}$/);

    await page.reload();
    await page
      .getByRole("button", { name: "Show tickets", exact: true })
      .click();
    await expect(qr).toBeVisible();
    expect(await prisma.ticket.count({ where: { guestId: guest.id } })).toBe(1);
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { guestId: guest.id } }))
        .token,
    ).toBe(guest.ticket!.token);
  } finally {
    const attendee = await prisma.user.findUnique({ where: { email } });

    if (attendee) fixtures.userIds.push(attendee.id);

    await fixtures.cleanup();
  }
});
