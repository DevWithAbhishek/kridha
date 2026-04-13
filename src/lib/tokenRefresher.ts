// Proactive refresh: fires 2 minutes before kridha_access expires.
// Reads expiry from the JWT without verifying (client doesn't have the secret —
// we just need the exp claim to schedule the next refresh).
// Falls back to 13-minute interval if decoding fails.

import axios from "axios";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function getAccessTokenExpiry(): number | null {
  // kridha_access is HttpOnly — we cannot read it from JS.
  // kridha_lang is NOT HttpOnly — we can read it.
  // Solution: server sets a non-HttpOnly mirror cookie "kridha_access_exp"
  // containing ONLY the expiry timestamp (no sensitive data).
  const match = document.cookie.match(/kridha_access_exp=([^;]+)/);
  if (!match) return null;
  return parseInt(match[1], 10); // Unix timestamp in seconds
}

async function doRefresh(): Promise<void> {
  try {
    await axios.post("/api/auth/refresh", null, { withCredentials: true });
    scheduleNextRefresh(); // reschedule after successful refresh
  } catch {
    // Refresh token also expired — redirect to login
    window.location.href = "/login";
  }
}

function scheduleNextRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);

  const exp = getAccessTokenExpiry();
  let msUntilRefresh: number;

  if (exp) {
    const msUntilExpiry = exp * 1000 - Date.now();
    // Refresh 2 minutes before expiry
    msUntilRefresh = Math.max(msUntilExpiry - 2 * 60 * 1000, 0);
  } else {
    // Fallback: refresh every 13 minutes (access token is 15min)
    msUntilRefresh = 13 * 60 * 1000;
  }

  refreshTimer = setTimeout(doRefresh, msUntilRefresh);
}

export function startTokenRefresher(): void {
  if (typeof window === "undefined") return; // SSR guard
  scheduleNextRefresh();
}

export function stopTokenRefresher(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
