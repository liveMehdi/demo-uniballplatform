import "dotenv/config";

export function demoAccount() {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;

  if (!email && !password) return null;

  if (!email || !password) {
    throw new Error("Set both DEMO_EMAIL and DEMO_PASSWORD, or leave both empty.");
  }

  // these credentials are intentionally public on the login page
  return { email, password };
}
