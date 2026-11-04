// use only the test database
const raw = process.env.TEST_DATABASE_URL;

if (!raw) {
  throw new Error(
    "Set TEST_DATABASE_URL to a dedicated local PostgreSQL database ending in _test. See TESTING.md.",
  );
}

const url = new URL(raw);

if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !/^[a-zA-Z0-9_]+_test$/.test(url.pathname.slice(1)) ||
  url.search ||
  url.hash
) {
  throw new Error(
    "Tests require a local database ending in _test, without URL query options.",
  );
}

process.env.DATABASE_URL = raw;
process.env.NODE_ENV = "test";

// keep dotenv from loading app credentials
process.env.DOTENV_CONFIG_PATH = new URL(
  "./no-application-env",
  import.meta.url,
).pathname;

process.env.BETTER_AUTH_SECRET =
  "integration-tests-only-secret-not-for-deployment-123456789";
process.env.PORT = "4318";
process.env.BETTER_AUTH_URL = "http://127.0.0.1:4318";
process.env.APP_URL = "http://127.0.0.1:4318";

process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "false";
process.env.EMAIL_MODE = "disabled";
process.env.EMAIL_FROM = "tests@example.test";
process.env.SMTP_URL = "smtp://127.0.0.1:1";

process.env.SERVE_CLIENT = "true";

export const testOrigin = process.env.APP_URL;
