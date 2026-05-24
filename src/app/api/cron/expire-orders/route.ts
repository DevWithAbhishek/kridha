// Expire PENDING SubOrders where advance was never paid (15 min timeout)
// Restores stock for each item

import { NextResponse } from "next/server";
import { releaseAllExpiredPendingOrders } from "@/lib/expiry";

export async function POST() {
  // Release anything older than 15 min that lazy expiry didn't catch
  await releaseAllExpiredPendingOrders();

  console.log(
    `[CRON] expire-orders: SubOrders cancelled, stock restored`,
  );
  return NextResponse.json({ status: "cleanup complete" });
}
