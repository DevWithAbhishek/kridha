import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ShieldCheck, BadgeCheck, Lock } from "lucide-react";
import Image from "next/image";

const PLATFORM_LINKS = [
  { label: "Browse Products", href: "/products" },
  { label: "Become a Seller", href: "/seller/register" },
  { label: "Track Your Order", href: "/orders" },
];

const SUPPORT_LINKS = [
  { label: "Help Centre", href: "/help" },
  { label: "FAQs", href: "/faq" },
  { label: "Contact", href: "mailto:support@kridha.in" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
];

const TRUST_STRIP = [
  { icon: Lock, label: "Secure Payments via Razorpay" },
  { icon: BadgeCheck, label: "Verified Sellers" },
  { icon: ShieldCheck, label: "Buyer Protection" },
];

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="bg-background-dark dark:bg-[#080909] border-t border-border-dark">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-10">
          {/* Col 1 — Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-3">
              <Image
                src="/images/kridha_logo_footer.png"
                alt="Kridha"
                height={32}
                width={120}
                className="hidden md:block"
              />
            </Link>
            <p className="text-label-sm text-muted-dark leading-relaxed max-w-[200px]">
              Buy directly from trusted local suppliers.
            </p>
          </div>

          {/* Col 2 — Platform */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Platform
            </p>
            <ul className="flex flex-col gap-2.5">
              {PLATFORM_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Support */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Support
            </p>
            <ul className="flex flex-col gap-2.5">
              {SUPPORT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Legal */}
          <div>
            <p className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
              Legal
            </p>
            <ul className="flex flex-col gap-2.5">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-label-sm text-text-dark/80 hover:text-kridha-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-5 pt-6 border-t border-border-dark flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {TRUST_STRIP.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-kridha-primary flex-shrink-0" />
              <span className="text-label-sm text-muted-dark">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-label-sm text-muted-dark order-2 sm:order-1">
            © {new Date().getFullYear()} Kridha Technologies Pvt. Ltd.
          </p>

          <div className="flex items-center gap-4 order-1 sm:order-2">
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-label-sm text-muted-dark hover:text-text-dark transition-colors duration-150"
              >
                {label}
              </Link>
            ))}
            <span className="text-label-sm text-muted-dark">
              Made in India 🇮🇳
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
