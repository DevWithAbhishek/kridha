export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      // GlitchTip DSN — format: https://<key>@app.glitchtip.com/<project-id>
      dsn: process.env.GLITCHTIP_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
    });
  }
}
