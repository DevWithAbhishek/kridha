// Pino structured JSON logger. Redacts sensitive fields before writing to stdout.
// pino-pretty in dev only — raw JSON in production (Vercel log drain reads it).
// ─────────────────────────────────────────────────────────────────────────────

import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",

  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  }),

  // Fields redacted before writing — never appear in any log output
  redact: {
    paths: [
      "pin",
      "newPin",
      "confirmPin",
      "otp",
      "deliveryOtp",
      "refreshToken",
      "accessToken",
      "tokenHash",
      "authorization",
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

  base: { service: "kridha-api" },
});
