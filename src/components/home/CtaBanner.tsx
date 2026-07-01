import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, BadgeCheck, Lock } from "lucide-react";

const TRUST_SIGNALS = [
  { icon: Lock, label: "Secure Payments" },
  { icon: BadgeCheck, label: "Verified Sellers" },
  { icon: ShieldCheck, label: "Buyer Protection" },
];

export function CtaBanner() {
  return (
    <section className="relative bg-background-dark dark:bg-[#080909] border-t border-border-dark py-20">
      <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
        <div className="lg:flex lg:items-center lg:justify-between lg:gap-16">
          <div className="lg:w-1/2">
            <h2 className="text-display-sm font-bold text-text-dark mb-4 tracking-tight">
              Buy fresh, direct from local suppliers.
            </h2>
            <p className="text-body-lg text-muted-dark mb-8 max-w-[440px]">
              No middlemen, no markups. Join the marketplace built on verified
              sellers and protected payments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Start Buying</Link>
              </Button>
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup?role=seller">Become a Seller</Link>
              </Button>
            </div>
          </div>

          <div className="lg:w-1/2 mt-12 lg:mt-0">
            <div className="flex flex-col gap-4 lg:items-end">
              {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-label-sm text-muted-dark"
                >
                  <Icon className="w-4 h-4 text-kridha-primary flex-shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
