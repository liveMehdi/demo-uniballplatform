import app from "./app.js";
import { boss } from "./lib/jobs.js";
import { createEmailQueue } from "./modules/notifications/emailQueue.js";
import { validateEmailConfiguration } from "./lib/emailConfig.js";

validateEmailConfiguration();

const PORT = Number(process.env.PORT) || 3000;

await boss.start();
await createEmailQueue();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
