// Created automatically by `npx @sentry/wizard -i nextjs` but shown here
// so the full picture is clear. Add userId on login via Sentry.setUser().
// ─────────────────────────────────────────────────────────────────────────────

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
});

// Call this after successful login in the frontend:
// Sentry.setUser({ id: userId });
// Call on logout:
// Sentry.setUser(null);
