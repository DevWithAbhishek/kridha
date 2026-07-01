"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, ShoppingCart } from "lucide-react";
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

  const navLinks = [{ href: "/", label: t("home") }];

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
          <Link
            href="/engineering"
            className="hidden md:inline text-label-sm text-[var(--color-text-muted)] hover:text-kridha-primary transition-colors duration-150"
          >
            Engineering
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          {!loading &&
            (isLoggedIn ? (
              <>
                <Link
                  href="/profile/cart"
                  aria-label="Shopping Cart"
                  className="inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                </Link>
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

// export function Navbar() {
//   const t = useTranslations("nav");
//   const pathname = usePathname();
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const { loading, isLoggedIn } = useLogin();
//   const queryClient = useQueryClient();

//   const navLinks = [{ href: "/", label: t("home") }];

//   const isActive = (href: string) => pathname === href;

//   return (
//     <header className="sticky top-0 z-sticky w-full bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
//       <div className="max-w-page mx-auto flex items-center justify-between h-16 px-page-x md:px-page-x-md">
//         {/* Brand + secondary link */}
//         <div className="flex items-center gap-6">
//           <Link href="/" className="flex items-center" aria-label="Kridha home">
//             <Image
//               src="/images/kridha_logo_nav.png"
//               alt="Kridha"
//               width={36}
//               height={36}
//               className="md:hidden"
//             />
//             <Image
//               src="/images/kridha_logo_footer.png"
//               alt="Kridha"
//               height={32}
//               width={120}
//               className="hidden md:block"
//             />
//           </Link>
//           <Link
//             href="/engineering"
//             className="hidden md:inline text-label-sm text-[var(--color-text-muted)] hover:text-kridha-primary transition-colors duration-150"
//           >
//             Engineering
//           </Link>
//         </div>

//         {/* Desktop actions */}
//         <div className="hidden md:flex items-center gap-1">
//           <div className="flex items-center gap-1 pr-3 mr-2 border-r border-[var(--color-border)]">
//             <LanguageToggle />
//             <ThemeToggle />
//           </div>

//           {!loading &&
//             (isLoggedIn ? (
//               <div className="flex items-center gap-2">
//                 <Link
//                   href="/profile/cart"
//                   aria-label="Shopping Cart"
//                   className="inline-flex items-center justify-center rounded-md p-2 text-[var(--color-text-muted)] hover:text-kridha-primary hover:bg-kridha-primary/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kridha-primary"
//                 >
//                   <ShoppingCart className="h-5 w-5" />
//                 </Link>
//                 <Button variant="primary" size="sm">
//                   <Link href="/profile/dashboard">Dashboard</Link>
//                 </Button>
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={async () => {
//                     await fetch("/api/auth/logout", { method: "POST" });
//                     queryClient.invalidateQueries({ queryKey: ["auth"] });
//                   }}
//                 >
//                   Logout
//                 </Button>
//               </div>
//             ) : (
//               <div className="flex items-center gap-2">
//                 <Button variant="outline" size="sm">
//                   <Link href="/login">{t("login")}</Link>
//                 </Button>
//                 <Button variant="primary" size="sm">
//                   <Link href="/login">{t("get_started")}</Link>
//                 </Button>
//               </div>
//             ))}
//         </div>

//         {/* Mobile actions */}
//         <div className="md:hidden flex items-center gap-1">
//           <ThemeToggle />
//           <LanguageToggle />
//           <button
//             onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//             aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
//             aria-expanded={mobileMenuOpen}
//             aria-controls="mobile-menu"
//             className="p-2 rounded-btn text-[var(--color-text-muted)] hover:text-kridha-primary hover:bg-kridha-primary/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kridha-primary"
//           >
//             {mobileMenuOpen ? (
//               <X className="w-5 h-5" />
//             ) : (
//               <Menu className="w-5 h-5" />
//             )}
//           </button>
//         </div>
//       </div>

//       {mobileMenuOpen && (
//         <div
//           id="mobile-menu"
//           className="md:hidden absolute top-full left-0 right-0 bg-[var(--color-surface)] animate-slide-in-up border-b border-[var(--color-border)] shadow-md"
//         >
//           <nav className="flex flex-col gap-1 p-4">
//             {navLinks.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 className={`text-label-md px-2 py-2 rounded-btn transition-colors duration-150 ${
//                   isActive(link.href)
//                     ? "text-kridha-primary font-semibold"
//                     : "text-[var(--color-text-muted)] hover:text-kridha-primary"
//                 }`}
//                 onClick={() => setMobileMenuOpen(false)}
//               >
//                 {link.label}
//               </Link>
//             ))}
//             <Link
//               href="/engineering"
//               className="text-label-md px-2 py-2 rounded-btn text-[var(--color-text-muted)] hover:text-kridha-primary transition-colors duration-150"
//               onClick={() => setMobileMenuOpen(false)}
//             >
//               Engineering
//             </Link>

//             <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
//               {!loading &&
//                 (isLoggedIn ? (
//                   <>
//                     <Link
//                       href="/profile/cart"
//                       aria-label="Shopping Cart"
//                       className="inline-flex items-center gap-2 px-2 py-2 rounded-btn text-label-md text-[var(--color-text-muted)] hover:text-kridha-primary hover:bg-kridha-primary/10 transition-colors duration-150"
//                       onClick={() => setMobileMenuOpen(false)}
//                     >
//                       <ShoppingCart className="h-4 w-4" />
//                       Cart
//                     </Link>
//                     <Button variant="primary" size="sm">
//                       <Link href="/profile/dashboard">Dashboard</Link>
//                     </Button>
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={async () => {
//                         await fetch("/api/auth/logout", { method: "POST" });
//                         window.location.reload(); // simple + effective
//                       }}
//                     >
//                       Logout
//                     </Button>
//                   </>
//                 ) : (
//                   <>
//                     <Button variant="outline" size="sm">
//                       <Link href="/login">{t("login")}</Link>
//                     </Button>
//                     <Button variant="primary" size="sm">
//                       <Link href="/login">{t("get_started")}</Link>
//                     </Button>
//                   </>
//                 ))}
//             </div>
//           </nav>
//         </div>
//       )}
//     </header>
//   );
// }
