import { boss } from "../lib/jobs.js";
import { emailEnabled } from "../lib/emailConfig.js";
import {
  EMAIL_QUEUE,
  AUTH_EMAIL_QUEUE,
} from "../modules/notifications/emailQueue.js";

try {
  if (!emailEnabled()) {
    console.log("Email is disabled. Email queues are not being processed.");
  } else {
    await boss.start();
    for (const name of [EMAIL_QUEUE, AUTH_EMAIL_QUEUE]) {
      const [stats] = await boss.getQueueStats(name, { force: true });
      if (!stats) throw new Error("Queue not initialized");
      console.log(name, {
        queued: stats.queuedCount,
        active: stats.activeCount,
        failed: stats.failedCount,
      });
      if (stats.failedCount > 0) process.exitCode = 1;
    }
  }
} catch {
  console.error(
    "Could not read email queue status. Check database access and start the API once to initialize queues.",
  );
  process.exitCode = 1;
} finally {
  await boss.stop();
}
