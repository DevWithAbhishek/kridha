import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { EditUserProfileSchema } from "@/schemas";
import { NextRequest, NextResponse } from "next/server";
import { record } from "zod";

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    const record = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        phone: true,
        name: true,
        street: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        profileImageUrl: true,
        preferredLang: true,
        roles: true,
        reliabilityScore: true,
        noShowCount: true,
        creditBalance: true,
        isFlagged: true,
        createdAt: true,
      },
    });
    if (!record) throw ERR.NOT_FOUND("User");
    return NextResponse.json({
      success: true,
      data: { user: record },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = EditUserProfileSchema.parse(await req.json());
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: body,
      select: {
        id: true,
        name: true,
        street: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        preferredLang: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ success: true, data: { user: updated } });
  } catch (err) {
    return handleError(err);
  }
}
