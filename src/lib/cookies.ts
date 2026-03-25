import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

export const COOKIE_OPTIONS = {
  accessToken: {
    name: "kridha_access",
    httpOnly: true,
    secure: IS_PROD,
    samesite: "strict" as const,
    path: "/",
    maxAge: 60 * 15,
  },
  refreshToken: {
    name: "kridha_refresh",
    httpOnly: true,
    secure: IS_PROD,
    samesite: "strict" as const,
    path: "/api/auth", // only sent to auth routes — not every request
    maxAge: 60 * 60 * 24 * 7,
  },
};

export function setAuthCookies(response: NextResponse, tokens: { accessToken: string, refreshToken: string }) {
    response.cookies.set(COOKIE_OPTIONS.accessToken.name, tokens.accessToken, COOKIE_OPTIONS.accessToken);
    response.cookies.set(COOKIE_OPTIONS.refreshToken.name, tokens.refreshToken, COOKIE_OPTIONS.refreshToken);
    return response;
}

export function clearAuthCookies(response: NextResponse) {
    response.cookies.set(COOKIE_OPTIONS.accessToken.name, '', { maxAge: 0, path: '/' });
    response.cookies.set(COOKIE_OPTIONS.refreshToken.name, '', { maxAge: 0, path: '/api/auth' });
    return response;
}