import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { GetNotificationsSchema } from "@/schemas";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    const q = GetNotificationsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const safePage = Math.max(1, q.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, q.limit ?? 20));

    const whereBase = {
      userId: user.userId,
      deletedAt: null,
      ...(q.status === "READ" ? { read: true } : {}),
      ...(q.status === "UNREAD" ? { read: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereBase,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          read: true,
          subOrderId: true,
          createdAt: true,
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: q.sortBy === "created_asc" ? "asc" : "desc" },
      }),
      prisma.notification.count({ where: whereBase }),
      prisma.notification.count({
        where: { userId: user.userId, read: false, deletedAt: null },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount, // always returned regardless of filter — used for badge
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        hasMore: (safePage - 1) * safeLimit + notifications.length < total,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
