import "./environment.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];

if (!["integration", "e2e", "prepare"].includes(mode ?? "")) {
  throw new Error("Expected integration, e2e, or prepare.");
}

function run(args: string[], cwd = serverDirectory, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env,
  });

  if (result.error) throw result.error;

  if (result.status !== 0)
    throw new Error(
      `Test command failed (exit ${result.status ?? result.signal}).`,
    );
}

// allow only one test run per database
const lock = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await lock.connect();

  const result = await lock.query(
    "SELECT pg_try_advisory_lock(4318, 1) AS acquired",
  );

  if (!result.rows[0].acquired)
    throw new Error("Another test run is using this database.");

  run([
    "node_modules/prisma/build/index.js",
    "generate",
    "--config",
    "prisma7.config.ts",
  ]);

  run([
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "prisma7.config.ts",
  ]);

  if (mode === "integration") {
    run([
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      "tests/integration.test.ts",
    ]);
  } else if (mode === "e2e") {
    const clientDirectory = fileURLToPath(
      new URL("../../client/", import.meta.url),
    );

    run(["node_modules/typescript/bin/tsc", "-b"], clientDirectory);
    run(["node_modules/vite/bin/vite.js", "build"], clientDirectory, {
      ...process.env,
      NODE_ENV: "production",
    });

    run([
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "tests/playwright.config.ts",
    ]);
  }
} finally {
  await lock.end();
}
