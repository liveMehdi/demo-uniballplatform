import {
  emailEnabled,
  validateEmailConfiguration,
} from "../lib/emailConfig.js";
import { verifyEmailTransport } from "../lib/email.js";

try {
  validateEmailConfiguration();
  if (emailEnabled()) {
    await verifyEmailTransport();
    console.log(
      "Email configuration and SMTP connection verified. No message was sent; inbox delivery is not verified.",
    );
  } else {
    console.log("Email is disabled. No transport connection was made.");
  }
} catch {
  console.error(
    "Email check failed. Check EMAIL_MODE, EMAIL_FROM, APP_URL and SMTP credentials/network access. Credentials are not logged.",
  );
  process.exitCode = 1;
}
