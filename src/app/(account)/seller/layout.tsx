"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Box,
  ShoppingCart,
  User,
  Bell,
  BadgePercent,
  ClipboardClock,
  ChartLine,
  Settings,
  LogOut,
  ListCollapse,
} from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const sellerNav = [
  { href: "/seller/dashboard", label: "Dashboard", icon: Home },
  { href: "/seller/products", label: "My Products", icon: ShoppingCart },
  { href: "/seller/orders", label: "My Orders", icon: Box },
  { href: "/seller/deals", label: "Deals", icon: BadgePercent },
  {
    href: "/seller/pickupWindows",
    label: "Pickup Windows",
    icon: ClipboardClock,
  },
];

const accountNav = [
  { href: "/seller/notifications", label: "Notifications", icon: Bell },
  { href: "/seller/analytics", label: "Analytics", icon: ChartLine },
  { href: "/seller/settings", label: "Settings", icon: Settings },
  { href: "/logout", label: "Logout", icon: LogOut },
];

const bottomTabs = [
  { href: "/seller/dashboard", label: "Home", icon: Home },
  { href: "/seller/products", label: "Products", icon: ShoppingCart },
  { href: "/seller/orders", label: "Orders", icon: Box },
  { href: "/seller/deals", label: "Deals", icon: BadgePercent },
  { href: "#", label: "More", icon: ListCollapse },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isSeller } = useAuth();

  const renderNav = (items: typeof sellerNav) =>
    items.map((item) => {
      const active = pathname === item.href;
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm transition ${
            active
              ? "bg-kridha-secondary text-kridha-primary font-semibold"
              : "text-[var(--color-text-muted)] hover:bg-background-subtle"
          }`}
        >
          <Icon className="w-4 h-4" />
          {item.label}
        </Link>
      );
    });

  return (
    <AuthGuard requireSeller>
      <div className="min-h-screen bg-[var(--color-bg)]">
        <aside className="hidden lg:block bg-[var(--color-surface)] dark:bg-surface-dark border-r border-[var(--color-border)] h-screen fixed left-0 top-0 pt-6 pb-6 overflow-y-auto z-sticky w-64 flex-col justify-around">
          <div className="flex items-center px-4 mb-2 justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/images/kridha_logo_nav.png"
                alt="Kridha"
                width={36}
                height={36}
              />
              <span className="text-h5 font-bold text-kridha-primary">
                Kridha
              </span>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-8 px-2 space-y-1">
            {renderNav(sellerNav)}
            <div className="text-label-sm font-semibold text-[var(--color-text-muted)] px-4 mb-2">
              Account
            </div>
            {renderNav(accountNav)}
          </div>
          <div className="my-3 flex justify-center">
            <LanguageToggle />
          </div>
        </aside>

        <div className="lg:ml-64">
          <div className="lg:hidden px-page-x py-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center gap-3">
              <Image
                src="/images/kridha_logo_nav.png"
                alt="Kridha"
                width={36}
                height={36}
              />
              <span className="text-h5 font-bold text-kridha-primary">
                Kridha
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <button
                type="button"
                className="p-2 rounded-btn hover:bg-kridha-primary/20 transition"
              >
                <Bell className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>

          <div className="pt-6 pb-20 lg:pt-8 lg:px-8">{children}</div>
        </div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex justify-around py-2 z-sticky">
          {bottomTabs.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;

            // 🔥 MORE BUTTON
            if (tab.label === "More") {
              return (
                <Dialog.Root key="more">
                  <Dialog.Trigger asChild>
                    <button className="flex flex-col items-center gap-1">
                      <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <span className="text-label-sm">More</span>
                    </button>
                  </Dialog.Trigger>

                  {/* 🔥 BOTTOM SHEET */}
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-overlay" />

                    <Dialog.Content className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto z-modal animate-slide-up">
                      {/* HEADER */}
                      <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-base font-semibold">
                          Menu
                        </Dialog.Title>

                        <Dialog.Close asChild>
                          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                            <X className="w-5 h-5" />
                          </button>
                        </Dialog.Close>
                      </div>

                      {/* SELLER NAV */}
                      {isSeller && (
                        <div className="mb-6">
                          <p className="text-xs text-[var(--color-text-muted)] mb-2 px-1">
                            Seller
                          </p>
                          <div className="space-y-1">
                            {renderNav(sellerNav)}
                          </div>
                        </div>
                      )}

                      {/* ACCOUNT NAV */}
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-2 px-1">
                          Account
                        </p>
                        <div className="space-y-1">{renderNav(accountNav)}</div>
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              );
            }

            // 🔥 NORMAL TABS
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-1"
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-kridha-primary" : "text-[var(--color-text-muted)]"}`}
                />
                <span
                  className={`text-label-sm ${active ? "text-kridha-primary" : "text-[var(--color-text-muted)]"}`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </AuthGuard>
  );
}
