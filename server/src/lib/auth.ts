import "dotenv/config";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import { demoAccount } from "./demoAccount.js";
import {
  appOrigin,
  emailEnabled,
  validateEmailConfiguration,
} from "./emailConfig.js";
import {
  AUTH_EMAIL_LIFETIME,
  enqueueAuthEmail,
} from "../modules/notifications/emailQueue.js";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!baseURL || !secret) {
  throw new Error("Missing Better Auth environment variables");
}

validateEmailConfiguration();
demoAccount();

export const auth = betterAuth({
  baseURL,
  secret,
  logger: {
    log(level) {
      if (level === "error") console.error("Authentication request failed.");
    },
  },

  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification:
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    resetPasswordTokenExpiresIn: AUTH_EMAIL_LIFETIME,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: emailEnabled()
      ? async (input) => enqueueAuthEmail("password_reset", input)
      : undefined,
  },
  emailVerification: emailEnabled()
    ? {
        sendOnSignUp: true,
        autoSignInAfterVerification: false,
        expiresIn: AUTH_EMAIL_LIFETIME,
        sendVerificationEmail: async (input) =>
          enqueueAuthEmail("email_verification", input),
      }
    : undefined,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const demo = demoAccount();

      if (demo) {
        const isDemo = (email: unknown) =>
          typeof email === "string" && email.trim().toLowerCase() === demo.email;
        let protectedAccount = false;

        if (ctx.path === "/request-password-reset") {
          protectedAccount = isDemo(ctx.body?.email);
        }

        if (
          [
            "/change-password",
            "/set-password",
            "/change-email",
            "/delete-user",
            "/unlink-account",
          ].includes(ctx.path)
        ) {
          const session = await getSessionFromCtx(ctx);
          protectedAccount = isDemo(session?.user.email);
        }

        // also reject reset links issued before demo access was enabled
        if (
          ctx.path === "/reset-password" ||
          ctx.path.startsWith("/reset-password/")
        ) {
          const token = ctx.body?.token || ctx.query?.token || ctx.params?.token;

          if (typeof token === "string") {
            const verification =
              await ctx.context.internalAdapter.findVerificationValue(
                `reset-password:${token}`,
              );
            const user = verification
              ? await ctx.context.internalAdapter.findUserById(verification.value)
              : null;

            protectedAccount = isDemo(user?.email);
          }
        }

        if (protectedAccount) {
          throw new APIError("FORBIDDEN", {
            code: "DEMO_ACCOUNT_PROTECTED",
            message:
              "The shared demo account's login details cannot be changed or reset.",
          });
        }
      }

      // block email endpoints when email delivery is disabled
      const emailRoute =
        [
          "/request-password-reset",
          "/send-verification-email",
          "/verify-email",
          "/reset-password",
        ].includes(ctx.path) || ctx.path.startsWith("/reset-password/");
      if (!emailEnabled() && emailRoute) {
        throw new APIError("FORBIDDEN", {
          code: "EMAIL_DISABLED",
          message: "Email is disabled for this demo.",
        });
      }
    }),
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  trustedOrigins: [baseURL, appOrigin()],
});
