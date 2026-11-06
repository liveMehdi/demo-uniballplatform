import { testOrigin } from "./environment.js";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Server } from "node:http";
import { Client } from "pg";
import { createFixtures, fixturePassword, prisma } from "./fixtures.js";

// queue emails without starting delivery
// the test smtp address uses a closed local port
process.env.EMAIL_MODE = "smtp";
process.env.SERVE_CLIENT = "false";

const { default: app } = await import("../src/app.js");
const { boss } = await import("../src/lib/jobs.js");
const { createEmailQueue } =
  await import("../src/modules/notifications/emailQueue.js");
const { registerReservationExpiry } =
  await import("../src/jobs/expireReservations.js");

const fixtures = createFixtures();

type Account = { id: string; cookie: string };

let alice: Account,
  bob: Account,
  organiser: Account,
  outsider: Account,
  scanner: Account;
let server: Server | undefined;

async function api(
  path: string,
  account?: Account,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`${testOrigin}/api${path}`, {
    method,
    headers: {
      Origin: testOrigin,
      ...(account ? { Cookie: account.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

async function account(): Promise<Account> {
  const result = await api("/auth/sign-up/email", undefined, "POST", {
    name: "Integration attendee",
    email: `${randomUUID()}@example.test`,
    password: fixturePassword,
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  fixtures.userIds.push(result.body.user.id);

  const cookie = result.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  assert.ok(cookie, "Real authentication must issue a session cookie");

  return { id: result.body.user.id, cookie };
}

before(
  async () => {
    await boss.start();
    await createEmailQueue();

    server = await new Promise<Server>((resolve, reject) => {
      const instance = app.listen(4318, "127.0.0.1", () => resolve(instance));
      instance.once("error", reject);
    });

    alice = await account();
    bob = await account();
    organiser = await account();
    outsider = await account();
    scanner = await account();
  },
  { timeout: 30_000 },
);

after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
      server!.closeIdleConnections();
    });

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: { in: fixtures.userIds } },
      select: { id: true },
    });

    const bookingIds = bookings.map(({ id }) => id);

    await prisma.$executeRaw`DELETE FROM pgboss.job
      WHERE data->>'bookingId' = ANY(${bookingIds}::text[])
      OR data->>'userId' = ANY(${fixtures.userIds}::text[])`;

    await fixtures.cleanup();
  } finally {
    await boss.stop();
    await prisma.$disconnect();
  }
});

type EventFixture = Awaited<ReturnType<typeof fixtures.event>>;

function reserve(
  event: EventFixture,
  user = alice,
  quantity = 1,
  requestKey = randomUUID(),
  tier = 0,
) {
  return api(`/events/${event.id}/bookings`, user, "POST", {
    requestKey,
    items: [{ ticketTypeId: event.ticketTypes[tier]!.id, quantity }],
  });
}

async function booking(event: EventFixture, user = alice, quantity = 1) {
  const result = await reserve(event, user, quantity);

  assert.equal(result.status, 201, JSON.stringify(result.body));

  return result.body.id as string;
}

async function fillGuests(
  bookingId: string,
  user = alice,
  mealOptionId: string | null = null,
) {
  const response = await api(`/bookings/${bookingId}/guests`, user);

  assert.equal(response.status, 200);

  for (const item of response.body.items) {
    for (const guest of item.guests) {
      const saved = await api(
        `/bookings/${bookingId}/guests/${guest.id}`,
        user,
        "PATCH",
        {
          expectedUpdatedAt: guest.updatedAt,
          fullName: `Guest ${guest.position}`,
          dietaryRequirements: "",
          accessibilityNeeds: "",
          mealOptionId,
        },
      );

      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }
  }
}

async function confirm(bookingId: string, user = alice) {
  const response = await api(`/bookings/${bookingId}/confirm`, user, "POST");

  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function ticket(bookingId: string) {
  return prisma.ticket.findFirstOrThrow({
    where: { guest: { bookingItem: { bookingId } } },
  });
}

async function waitUntil(
  check: () => Promise<boolean>,
  message: string,
  timeout = 3000,
) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await check()) return;

    await delay(25);
  }

  assert.fail(message);
}

// hold the row lock until both requests are waiting
// this makes sure the requests overlap
async function race<T>(
  table: "Event" | "Ticket",
  id: string,
  operations: (() => Promise<T>)[],
) {
  const blocker = new Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();

  let requests: Promise<T[]> | undefined;

  try {
    await blocker.query("BEGIN");
    await blocker.query(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, [
      id,
    ]);

    requests = Promise.all(operations.map((operation) => operation()));

    await waitUntil(async () => {
      // refresh the cached activity snapshot
      await blocker.query("SELECT pg_stat_clear_snapshot()");

      const result = await blocker.query(
        `SELECT count(*)::int AS count FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
         AND query LIKE $1`,
        [`%"${table}"%`],
      );

      return result.rows[0].count >= operations.length;
    }, `Both competing requests must reach the ${table} lock`);

    await blocker.query("COMMIT");

    return await requests;
  } finally {
    await blocker.query("ROLLBACK");
    if (requests) await requests.catch(() => undefined);
    await blocker.end();
  }
}

test(
  "capacity: competing requests cannot oversell the event or a ticket tier",
  { timeout: 30_000 },
  async () => {
    for (const limit of ["event", "tier"] as const) {
      const event = await fixtures.event(organiser.id, {
        capacity: limit === "event" ? 1 : 2,
        tierCapacity: 1,
      });

      const aliceKey = randomUUID();
      const bobKey = randomUUID();
      const operations = [
        () => reserve(event, alice, 1, aliceKey),
        () => reserve(event, bob, 1, bobKey, limit === "event" ? 1 : 0),
      ];
      const results = await race("Event", event.id, operations);

      assert.equal(
        results.filter((result) => result.status === 201).length,
        1,
        JSON.stringify(results),
      );

      // contention can exhaust the server's bounded transaction retries
      // retry that request once after the race, keeping its original key
      const settled = [...results];

      for (const [index, result] of results.entries()) {
        if (result.status !== 503) continue;

        assert.equal(result.body.error, "Booking is busy. Please try again.");
        settled[index] = await operations[index]!();
        assert.equal(settled[index]!.status, 409, JSON.stringify(settled[index]));
      }

      assert.deepEqual(
        settled.map((r) => r.status).sort(),
        [201, 409],
        JSON.stringify({ initial: results, settled }),
      );

      const saved = await prisma.booking.findMany({
        where: { eventId: event.id },
        include: { items: true },
      });

      assert.equal(saved.length, 1);
      assert.equal(
        saved
          .flatMap((b) => b.items)
          .reduce((sum, item) => sum + item.quantity, 0),
        1,
      );
    }
  },
);

test("idempotency: concurrent retries create one booking and changed payloads are rejected", async () => {
  const event = await fixtures.event(organiser.id);
  const key = randomUUID();

  const results = await race("Event", event.id, [
    () => reserve(event, alice, 1, key),
    () => reserve(event, alice, 1, key),
  ]);

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  assert.equal(results[0]!.body.id, results[1]!.body.id);
  assert.equal(
    (await reserve(event, alice, 1, key)).body.id,
    results[0]!.body.id,
  );
  assert.equal((await reserve(event, alice, 2, key)).status, 409);

  assert.equal(await prisma.booking.count({ where: { eventId: event.id } }), 1);
  assert.equal(
    await prisma.bookingGuest.count({
      where: { bookingItem: { booking: { eventId: event.id } } },
    }),
    1,
  );
});

test("permissions: ownership, society boundaries and delegated scanner access are enforced by the API", async () => {
  const event = await fixtures.event(organiser.id);
  const otherEvent = await fixtures.event(outsider.id);
  const id = await booking(event);

  assert.equal((await api(`/bookings/${id}/guests`)).status, 401);
  assert.equal((await api(`/bookings/${id}/guests`, bob)).status, 404);
  assert.equal((await api(`/bookings/${id}/tickets`, bob, "POST")).status, 404);
  assert.equal((await api(`/bookings/${id}/confirm`, bob, "POST")).status, 404);
  assert.equal((await api(`/bookings/${id}/cancel`, bob, "POST")).status, 404);

  const guest = await prisma.bookingGuest.findFirstOrThrow({
    where: { bookingItem: { bookingId: id } },
  });

  assert.equal(
    (
      await api(`/bookings/${id}/guests/${guest.id}`, bob, "PATCH", {
        expectedUpdatedAt: guest.updatedAt.toISOString(),
        fullName: "Not the owner",
        dietaryRequirements: "",
        accessibilityNeeds: "",
        mealOptionId: null,
      })
    ).status,
    404,
  );

  assert.equal(
    (await api(`/events/${event.id}/bookings`, outsider)).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/capacity`, outsider, "PATCH", {
        capacity: 20,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/capacity`, alice, "PATCH", {
        capacity: 20,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/cancel`, outsider, "POST", {
        confirmation: "CANCEL",
      })
    ).status,
    403,
  );
  assert.equal(
    (await api(`/events/${event.id}/bookings`, organiser)).status,
    200,
  );

  await fillGuests(id);
  await confirm(id);

  const admission = await ticket(id);

  await prisma.eventScanAccess.create({
    data: { eventId: event.id, userId: scanner.id },
  });

  assert.equal(
    (await api(`/scanner/events/${event.id}/attendance`, scanner)).status,
    200,
  );
  assert.equal(
    (await api(`/scanner/events/${otherEvent.id}/attendance`, scanner)).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/check-in`, bob, "POST", {
        token: admission.token,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${otherEvent.id}/check-in`, scanner, "POST", {
        token: admission.token,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/check-in`, scanner, "POST", {
        token: admission.token,
      })
    ).status,
    200,
  );
  assert.equal(
    (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
      .capacity,
    10,
  );
  assert.equal(
    (await prisma.bookingGuest.findUniqueOrThrow({ where: { id: guest.id } }))
      .fullName,
    "Guest 1",
  );
});

test("check-in: simultaneous scans admit once and later scans remain rejected", async () => {
  const event = await fixtures.event(organiser.id);
  const id = await booking(event);

  await fillGuests(id);
  await confirm(id);

  const admission = await ticket(id);
  const scan = () =>
    api(`/events/${event.id}/check-in`, organiser, "POST", {
      token: admission.token,
    });

  const results = await race("Ticket", admission.id, [scan, scan]);

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.deepEqual(results.map((r) => r.body.status).sort(), [
    "already_checked_in",
    "checked_in",
  ]);

  const saved = await prisma.ticket.findUniqueOrThrow({
    where: { id: admission.id },
  });

  assert.ok(saved.checkedInAt);

  const repeated = await scan();

  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.checkedInAt, saved.checkedInAt.toISOString());
  assert.deepEqual(
    (await api(`/scanner/events/${event.id}/attendance`, organiser)).body,
    { confirmedGuests: 1, checkedIn: 1, remaining: 0 },
  );
});

test(
  "expiry: overdue holds cannot confirm and the real worker releases capacity",
  { timeout: 30_000 },
  async () => {
    const event = await fixtures.event(organiser.id, { capacity: 1 });
    const id = await booking(event);
    await fillGuests(id);

    // move the deadline into the past to avoid waiting
    await prisma.booking.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    assert.equal(
      (await api(`/bookings/${id}/confirm`, alice, "POST")).status,
      409,
    );
    assert.equal((await reserve(event, bob)).status, 409);

    try {
      await registerReservationExpiry();
      await waitUntil(
        async () =>
          (await prisma.booking.findUniqueOrThrow({ where: { id } })).status ===
          "EXPIRED",
        "The reservation worker must mark the hold expired",
        15_000,
      );

      assert.equal((await reserve(event, bob)).status, 201);
      assert.equal(
        await prisma.ticket.count({
          where: { guest: { bookingItem: { bookingId: id } } },
        }),
        0,
      );
    } finally {
      await boss.offWork("expire-reservations");
      await boss.unschedule("expire-reservations");
      await boss.deleteAllJobs("expire-reservations");
    }
  },
);

test("confirmation: guest details and meals are required, and retries preserve one ticket per guest", async () => {
  const event = await fixtures.event(organiser.id, { catered: true });
  const id = await booking(event, alice, 2);

  assert.equal(
    (await api(`/bookings/${id}/confirm`, alice, "POST")).status,
    409,
  );

  await fillGuests(id);

  assert.equal(
    (await api(`/bookings/${id}/confirm`, alice, "POST")).status,
    409,
  );
  assert.equal(
    (await prisma.booking.findUniqueOrThrow({ where: { id } })).status,
    "PENDING",
  );
  assert.equal(
    await prisma.ticket.count({
      where: { guest: { bookingItem: { bookingId: id } } },
    }),
    0,
  );

  await fillGuests(id, alice, event.mealOptions[0]!.id);
  await confirm(id);

  const where = { guest: { bookingItem: { bookingId: id } } };
  const original = await prisma.ticket.findMany({
    where,
    orderBy: { id: "asc" },
  });

  await confirm(id);

  assert.equal(original.length, 2);
  assert.equal(new Set(original.map((t) => t.guestId)).size, 2);
  assert.ok(original.every((t) => /^[a-f0-9]{64}$/.test(t.token)));
  assert.deepEqual(
    await prisma.ticket.findMany({ where, orderBy: { id: "asc" } }),
    original,
  );
  assert.equal(
    (await prisma.booking.findUniqueOrThrow({ where: { id } })).status,
    "CONFIRMED",
  );

  const jobs = await prisma.$queryRaw<{ data: { kind: string } }[]>`
    SELECT data FROM pgboss.job WHERE name = 'booking-emails' AND data->>'bookingId' = ${id}`;

  assert.deepEqual(
    jobs.map((j) => j.data.kind),
    ["tickets"],
  );
});

test("cancellation: bookings, tickets and notifications change together and further activity is blocked", async () => {
  const event = await fixtures.event(organiser.id);
  const confirmedId = await booking(event);

  await fillGuests(confirmedId);
  await confirm(confirmedId);

  const pendingId = await booking(event, bob);
  const admission = await ticket(confirmedId);

  // publish seating so cancellation can withdraw it
  await prisma.event.update({
    where: { id: event.id },
    data: { seatingPublishedAt: new Date() },
  });

  assert.equal(
    (
      await api(`/events/${event.id}/cancel`, organiser, "POST", {
        confirmation: "CANCEL",
      })
    ).status,
    200,
  );

  const saved = await prisma.event.findUniqueOrThrow({
    where: { id: event.id },
  });

  assert.ok(saved.cancelledAt);
  assert.equal(saved.salesClosed, true);
  assert.equal(saved.seatingPublishedAt, null);

  const bookings = await prisma.booking.findMany({
    where: { eventId: event.id },
  });

  assert.equal(bookings.length, 2);
  assert.ok(bookings.every((b) => b.status === "CANCELLED"));
  assert.ok(
    (await prisma.ticket.findUniqueOrThrow({ where: { id: admission.id } }))
      .revokedAt,
  );

  assert.equal((await reserve(event)).status, 409);
  assert.equal(
    (await api(`/bookings/${pendingId}/confirm`, bob, "POST")).status,
    409,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/check-in`, organiser, "POST", {
        token: admission.token,
      })
    ).status,
    409,
  );
  assert.equal(
    (await api(`/bookings/${confirmedId}/tickets`, alice, "POST")).status,
    409,
  );
  assert.equal(
    (
      await api(`/events/${event.id}/cancel`, organiser, "POST", {
        confirmation: "CANCEL",
      })
    ).status,
    200,
  );
  const jobs = await prisma.$queryRaw<{ id: string }[]>`
    SELECT data->>'bookingId' AS id FROM pgboss.job
    WHERE name = 'booking-emails' AND data->>'kind' = 'event_cancelled'
    AND data->>'bookingId' = ANY(${[confirmedId, pendingId]}::text[])`;

  assert.deepEqual(
    jobs.map((j) => j.id).sort(),
    [confirmedId, pendingId].sort(),
  );
});

test("shared demo credentials stay usable and ordinary accounts can change and reset passwords", async () => {
  const demoUser = await prisma.user.findUniqueOrThrow({ where: { id: organiser.id } });
  const normalUser = await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } });
  const newPassword = "Updated-test-password-123!";

  assert.equal((await api("/config")).body.demoAccount, null);

  // issue a real reset link before protecting the account
  assert.equal((await api("/auth/request-password-reset", undefined, "POST", {
    email: demoUser.email,
  })).status, 200);

  const oldReset = await prisma.verification.findFirstOrThrow({
    where: { value: organiser.id, identifier: { startsWith: "reset-password:" } },
  });
  const oldToken = oldReset.identifier.slice("reset-password:".length);

  process.env.DEMO_EMAIL = demoUser.email.toUpperCase();
  process.env.DEMO_PASSWORD = fixturePassword;

  try {
    const config = await api("/config");
    assert.equal(config.headers.get("cache-control"), "no-store");
    assert.deepEqual(config.body.demoAccount, { email: demoUser.email, password: fixturePassword });

    const blocked = await api("/auth/change-password", organiser, "POST", {
      currentPassword: fixturePassword,
      newPassword,
      revokeOtherSessions: true,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "DEMO_ACCOUNT_PROTECTED");

    assert.equal((await api("/auth/request-password-reset", undefined, "POST", {
      email: demoUser.email.toUpperCase(),
    })).status, 403);

    for (const path of ["/auth/reset-password", `/auth/reset-password?token=${oldToken}`]) {
      const result = await api(path, undefined, "POST", {
        newPassword,
        ...(path.includes("?") ? {} : { token: oldToken }),
      });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "DEMO_ACCOUNT_PROTECTED");
    }

    const callback = await fetch(
      `${testOrigin}/api/auth/reset-password/${oldToken}?callbackURL=${encodeURIComponent(testOrigin + "/reset-password")}`,
      { redirect: "manual" },
    );
    assert.equal(callback.status, 403);

    const signIn = await api("/auth/sign-in/email", undefined, "POST", {
      email: demoUser.email,
      password: fixturePassword,
    });
    assert.equal(signIn.status, 200);
    assert.equal(signIn.body.user.id, organiser.id);

    assert.equal((await api("/auth/change-password", outsider, "POST", {
      currentPassword: fixturePassword,
      newPassword,
    })).status, 200);

    assert.equal((await api("/auth/request-password-reset", undefined, "POST", {
      email: normalUser.email,
    })).status, 200);

    const normalReset = await prisma.verification.findFirstOrThrow({
      where: { value: outsider.id, identifier: { startsWith: "reset-password:" } },
    });

    assert.equal((await api("/auth/reset-password", undefined, "POST", {
      token: normalReset.identifier.slice("reset-password:".length),
      newPassword: fixturePassword,
    })).status, 200);

    assert.equal((await api("/auth/sign-in/email", undefined, "POST", {
      email: normalUser.email,
      password: fixturePassword,
    })).status, 200);
  } finally {
    process.env.DEMO_EMAIL = "";
    process.env.DEMO_PASSWORD = "";
    await prisma.verification.deleteMany({ where: { value: { in: [organiser.id, outsider.id] } } });
  }
});
