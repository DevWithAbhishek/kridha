import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Providers wrapper (see below implementation)
import { Providers } from "@/components/Providers";

// Metadata for SEO & PWA
export const metadata: Metadata = {
  title: "Kridha — किराना का भरोसेमंद साथी",
  description: "B2B+B2C self-pickup marketplace for kirana owners and suppliers in UP",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kridha",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2A9D8F'
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect/Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans antialiased min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}