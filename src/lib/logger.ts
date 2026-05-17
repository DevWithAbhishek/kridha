// Pino structured JSON logger. Redacts sensitive fields before writing to stdout.
// pino-pretty in dev only — raw JSON in production (Vercel log drain reads it).
// ─────────────────────────────────────────────────────────────────────────────

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
  base: { service: "kridha-api" },

  // Fields redacted before writing — never appear in any log output
  redact: {
    paths: [
      "pinHash",
      "newPin",
      "confirmPin",
      "otp",
      "deliveryOtp",
      "refreshToken",
      "accessToken",
      "tokenHash",
      "authorization",
      "userSession",
      "headers.authorization",
      "headers.cookie",
      "body.pin",
      "body.newPin",
      "body.otp",
      "accountNumber",
      "ifscCode",
      "panNumber",
    ],
    censor: "[REDACTED]",
  },
});
