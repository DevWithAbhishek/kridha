import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";

type NotifParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: NotifParams) {
  try {
    const user = await getUser(req);
    const { id } = await params;
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.deletedAt) throw ERR.NOTIFICATION_NOT_FOUND;
    if (n.userId !== user.userId) throw ERR.NOT_YOUR_NOTIFICATION;
    return NextResponse.json({ success: true, data: { notification: n } });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: NotifParams) {
  try {
    const user = await getUser(req);
    const { id } = await params;
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.deletedAt) throw ERR.NOTIFICATION_NOT_FOUND;
    if (n.userId !== user.userId) throw ERR.NOT_YOUR_NOTIFICATION;
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return NextResponse.json({
      success: true,
      data: { notification: { id: updated.id, read: updated.read } },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: NotifParams) {
  try {
    const user = await getUser(req);
    const { id } = await params;
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.deletedAt) throw ERR.NOTIFICATION_NOT_FOUND;
    if (n.userId !== user.userId) throw ERR.NOT_YOUR_NOTIFICATION;
    await prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (err) {
    return handleError(err);
  }
}
