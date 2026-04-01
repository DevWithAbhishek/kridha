// setAuthCookies / clearAuthCookies — used by login + logout routes.
// kridha_refresh path=/api/auth — only sent on auth requests.
// kridha_lang NOT HttpOnly — next-intl client-side needs it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function setAuthCookies(
  res: NextResponse,
  tokens: TokenPair,
  preferredLang: string,
): void {
  res.cookies.set("kridha_access", tokens.accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15,
  });
  res.cookies.set("kridha_refresh", tokens.refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 60 * 60 * 24 * 7,
  });
  // Not HttpOnly — next-intl reads this from client JS
  res.cookies.set("kridha_lang", preferredLang === "en" ? "en" : "hi", {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set("kridha_access", "", { maxAge: 0, path: "/" });
  res.cookies.set("kridha_refresh", "", { maxAge: 0, path: "/api/auth" });
  res.cookies.set("kridha_lang", "", { maxAge: 0, path: "/" });
}
