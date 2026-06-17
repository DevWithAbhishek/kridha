"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin } from "@/hooks/useLogin";

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { loading, isLoggedIn } = useLogin();
  const queryClient = useQueryClient();

  const navLinks = [
    { href: "/", label: t("home") },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-sticky w-full bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-page mx-auto flex items-center justify-between h-16 px-page-x md:px-page-x-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/kridha_logo_nav.png"
              alt="Kridha"
              width={36}
              height={36}
              className="md:hidden"
            />
            <Image
              src="/images/kridha_logo_footer.png"
              alt="Kridha"
              height={32}
              width={120}
              className="hidden md:block"
            />
          </Link>
          <Link href="/engineering"> Engineering </Link>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          {!loading &&
            (isLoggedIn ? (
              <>
                <Button variant="primary" size="sm">
                  <Link href="/profile/dashboard">Dashboard</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    queryClient.invalidateQueries({ queryKey: ["auth"] });
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm">
                  <Link href="/login">{t("login")}</Link>
                </Button>
                <Button variant="primary" size="sm">
                  <Link href="/login">{t("get_started")}</Link>
                </Button>
              </>
            ))}
        </div>
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-btn hover:bg-kridha-primary/20 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--color-surface)] animate-slide-in-up border-b border-[var(--color-border)]">
          <nav className="flex flex-col gap-4 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-label-md transition-colors ${
                  isActive(link.href)
                    ? "text-kridha-primary font-semibold"
                    : "text-[var(--color-text-muted)] hover:text-kridha-primary"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-4">
              {!loading &&
                (isLoggedIn ? (
                  <>
                    <Button variant="primary" size="sm">
                      <Link href="/profile/dashboard">Dashboard</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        window.location.reload(); // simple + effective
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm">
                      <Link href="/login">{t("login")}</Link>
                    </Button>
                    <Button variant="primary" size="sm">
                      <Link href="/login">{t("get_started")}</Link>
                    </Button>
                  </>
                ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
