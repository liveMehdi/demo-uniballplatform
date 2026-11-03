import "dotenv/config";
import nodemailer from "nodemailer";
import { emailEnabled, emailSettings } from "./emailConfig.js";

async function createEmailTransport() {
  const { mode, smtp } = emailSettings();

  if (mode === "ethereal") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Ethereal email mode is not allowed in production.");
    }

    const account = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  }

  if (mode === "smtp") {
    return nodemailer.createTransport(smtp!);
  }

  throw new Error("Email delivery is disabled.");
}

let transportPromise: ReturnType<typeof createEmailTransport> | undefined;

function getEmailTransport() {
  if (!transportPromise) {
    transportPromise = createEmailTransport().catch((error) => {
      transportPromise = undefined;
      throw error;
    });
  }

  return transportPromise;
}

export async function sendAppEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!emailEnabled())
    return { messageId: undefined, previewUrl: false, skipped: true };
  const { from } = emailSettings();

  const transport = await getEmailTransport();

  const result = await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  const previewUrl =
    process.env.EMAIL_MODE === "ethereal"
      ? nodemailer.getTestMessageUrl(result)
      : false;

  if (previewUrl) {
    console.log("Email preview:", previewUrl);
  }

  return {
    messageId: result.messageId,
    previewUrl,
  };
}

export async function verifyEmailTransport() {
  if (!emailEnabled()) return;
  const transport = await getEmailTransport();
  await transport.verify();
  transport.close();
  transportPromise = undefined;
}
