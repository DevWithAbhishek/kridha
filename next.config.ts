import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' checkout.razorpay.com",
      "img-src 'self' res.cloudinary.com data: blob:",
      "connect-src 'self' *.neon.tech *.upstash.io *.sentry.io api.razorpay.com",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ← Minimal but important addition
  experimental: {
    cpus: 1, // Limits build to 1 CPU core (prevents OOM/hang on Hobby)
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  images: {
    remotePatterns: [{ hostname: "res.cloudinary.com" }],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "abhishek-kumar-oe",
  project: "kridha",

  silent: !process.env.CI,

  widenClientFileUpload: true,

  // Keep your existing Sentry options
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
