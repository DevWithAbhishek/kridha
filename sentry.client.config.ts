import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  tracesSampleRate: 0.1,
  // No replayIntegration — not supported on GlitchTip free tier
});

// After successful login, call from your frontend component (not from route handler):
// import * as Sentry from '@sentry/nextjs';
// Sentry.setUser({ id: userId });
//
// On logout:
// Sentry.setUser(null);

//
