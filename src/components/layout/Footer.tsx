import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, Phone, Mail } from "lucide-react";

const PRODUCT_LINKS = [
  { label: "Browse Products", href: "/products" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Become a Seller", href: "/seller/register" },
  { label: "Pricing", href: "/pricing" },
  { label: "Track Your Order", href: "/orders" },
];

const COMPANY_LINKS = [
  { label: "About Kridha", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Press", href: "/press" },
];

const SUPPORT_LINKS = [
  { label: "Help Centre", href: "/help" },
  { label: "Buyer FAQs", href: "/faq#buyer" },
  { label: "Seller FAQs", href: "/faq#seller" },
  { label: "Report an Issue", href: "/support/report" },
  { label: "Refund Policy", href: "/refund-policy" },
];

const TRUST_POINTS = [
  "Advance payments protected by Razorpay",
  "Seller KYC verified before listing",
  "End-to-end order tracking with OTP pickup",
];


export async function Footer() {
    const t = await getTranslations('footer');

  return (
    <footer className="bg-background-dark dark:bg-[#080909] border-t border-border-dark">
      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Col 1 — Brand + trust statement */}
          <div className="sm:col-span-2 lg:col-span-1">
            {/* Logo mark */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 mb-4 group"
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-lg
                           bg-kridha-primary text-white font-black text-base leading-none"
              >
                K
              </span>
              <span className="text-h6 font-bold text-text-dark tracking-tight">
                Kridha
              </span>
            </Link>

            <p className="text-label-sm text-muted-dark leading-relaxed mb-5 max-w-[220px]">
              Buy directly from local suppliers in your city. No middlemen.
              Guaranteed freshness.
            </p>

            {/* Trust badge strip */}
            <div
              className="flex flex-col gap-2 p-3 rounded-xl
                         bg-surface-dark border border-border-dark"
            >
              <div className="flex items-center gap-1.5 text-kridha-primary">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Buyer Protection
                </span>
              </div>
              {TRUST_POINTS.map((point) => (
                <p
                  key={point}
                  className="text-label-sm text-muted-dark leading-snug pl-5"
                >
                  {point}
                </p>
              ))}
            </div>
          </div>

          {/* Col 2 — Product */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Platform
            </p>
            <ul className="flex flex-col gap-2.5">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary
                               transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Company */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Company
            </p>
            <ul className="flex flex-col gap-2.5">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary
                               transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mt-7 mb-4">
              Support
            </p>
            <ul className="flex flex-col gap-2.5">
              {SUPPORT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary
                               transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Contact Us
            </p>

            <div className="flex flex-col gap-4">
              <a
                href="tel:+918000000000"
                className="group flex items-start gap-3 p-3 rounded-xl
                           bg-surface-dark border border-border-dark
                           hover:border-kridha-primary/40 transition-colors duration-200"
              >
                <Phone className="w-4 h-4 text-kridha-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-label-sm font-semibold text-text-dark mb-0.5">
                    Call / WhatsApp
                  </p>
                  <p className="text-label-sm text-muted-dark">
                    +91 80000 00000
                  </p>
                  <p className="text-[10px] text-muted-dark/70 mt-0.5">
                    Mon – Sat, 9 AM – 7 PM
                  </p>
                </div>
              </a>

              <a
                href="mailto:support@kridha.in"
                className="group flex items-start gap-3 p-3 rounded-xl
                           bg-surface-dark border border-border-dark
                           hover:border-kridha-primary/40 transition-colors duration-200"
              >
                <Mail className="w-4 h-4 text-kridha-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-label-sm font-semibold text-text-dark mb-0.5">
                    Email Support
                  </p>
                  <p className="text-label-sm text-muted-dark break-all">
                    support@kridha.in
                  </p>
                  <p className="text-[10px] text-muted-dark/70 mt-0.5">
                    Reply within 24 hours
                  </p>
                </div>
              </a>

              {/* Language note */}
              <p className="text-label-sm text-muted-dark leading-snug">
                हम हिन्दी में भी सहायता करते हैं।
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border-dark">
        <div
          className="max-w-5xl mx-auto px-4 sm:px-6 py-5
                     flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <p className="text-label-sm text-muted-dark order-2 sm:order-1">
            © {new Date().getFullYear()} Kridha Technologies Pvt. Ltd. All
            rights reserved.
          </p>

          <div className="flex items-center gap-4 order-1 sm:order-2">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Use", href: "/terms" },
              { label: "Shipping Policy", href: "/shipping" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-label-sm text-muted-dark hover:text-text-dark
                           transition-colors duration-150"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}