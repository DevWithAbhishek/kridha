import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  const result = await prisma.deal.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  console.log(`[CRON] expire-deals: ${result.count} expired`);
  return NextResponse.json({ expired: result.count });
}
