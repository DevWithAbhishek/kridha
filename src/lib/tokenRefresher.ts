import { refreshClient } from "@/lib/api";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Session signal: non-HttpOnly expiry cookie
function hasSession(): boolean {
  return document.cookie.includes("kridha_access_exp=");
}

function getAccessTokenExpiry(): number | null {
  const match = document.cookie.match(/kridha_access_exp=([^;]+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

async function doRefresh(): Promise<void> {
  try {
    // 🔥 Guard: do not refresh if no session
    if (!hasSession()) return;

    // Use clean client → no interceptor recursion
    await refreshClient.post("/auth/refresh");

    // Reschedule only on success
    scheduleNextRefresh();
  } catch {
    // 🔥 Hard stop on failure (no loops)
    stopTokenRefresher();

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
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
    // Fallback (should be rare if cookie exists)
    msUntilRefresh = 13 * 60 * 1000;
  }

  refreshTimer = setTimeout(doRefresh, msUntilRefresh);
}

export function startTokenRefresher(): void {
  if (typeof window === "undefined") return;

  // 🔥 Guard: only start if session exists
  if (!hasSession()) return;

  scheduleNextRefresh();
}

export function stopTokenRefresher(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
