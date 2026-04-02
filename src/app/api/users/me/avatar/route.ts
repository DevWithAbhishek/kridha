// POST — upload avatar (client uploads to Cloudinary, sends url+publicId).
// DELETE — remove avatar + delete from Cloudinary.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { EditUserAvatarSchema } from "@/schemas";
import { prisma } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = EditUserAvatarSchema.parse(await req.json());
    const record = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { profileImagePublicId: true },
    });

    // Delete old avatar from Cloudinary if exists
    if (record?.profileImagePublicId) {
      cloudinary.uploader
        .destroy(record.profileImagePublicId)
        .catch(console.error);
    }

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: { profileImageUrl: body.profileImageUrl, profileImagePublicId: body.profileImagePublicId},
      select: { id: true, profileImageUrl: true },
    });
    return NextResponse.json({ success: true, data: { user: updated } });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUser(req);
    const record = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { profileImagePublicId: true },
    });

    if (record?.profileImagePublicId) {
      cloudinary.uploader
        .destroy(record.profileImagePublicId)
        .catch(console.error);
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { profileImageUrl: null, profileImagePublicId: null },
    });
    return NextResponse.json({ success: true, message: "Avatar removed." });
  } catch (err) {
    return handleError(err);
  }
}
