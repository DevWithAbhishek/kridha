import type { NextConfig } from "next";
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

      // ✅ Razorpay scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",

      // Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // ✅ Images (unchanged)
      "img-src 'self' res.cloudinary.com data: blob:",

      // ✅ API calls + Razorpay tracking
      "connect-src 'self' https://api.cloudinary.com *.supabase.co *.upstash.io app.glitchtip.com https://api.razorpay.com https://lumberjack.razorpay.com",

      // ✅ REQUIRED for Razorpay modal
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",

      "font-src 'self' https://fonts.gstatic.com data:",

      // prevention from session hijacking
      "frame-ancestors 'none'", // prevents clickjacking / UI redressing
      "object-src 'none'", // blocks Flash, Java applets
      "base-uri 'self'", // prevents base tag hijacking
      "form-action 'self'", //forms can only submit to same origin
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ← Minimal but important addition
  experimental: {
    cpus: 1, // Limits build to 1 CPU core (prevents OOM/hang on Hobby)
    optimizeCss: true,
    serverSourceMaps: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [{ hostname: "res.cloudinary.com" }],
    formats: ["image/avif", "image/webp"],
  },
};

// withNextIntl only — GlitchTip needs no webpack plugin at build time
export default withNextIntl(nextConfig);
