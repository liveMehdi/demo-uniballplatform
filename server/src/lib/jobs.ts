import "dotenv/config";
import { PgBoss } from "pg-boss";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const boss = new PgBoss({
  connectionString,
});

boss.on("error", () => {
  console.error(
    "Background job error. Check database access and worker health.",
  );
});
