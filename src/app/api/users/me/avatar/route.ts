// POST — upload avatar (client uploads to Cloudinary, sends url+publicId).
// DELETE — remove avatar + delete from Cloudinary.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { EditUserAvatarSchema } from "@/schemas";
import { v2 as cloudinary } from "cloudinary";
import { userService } from "@/services/user.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = EditUserAvatarSchema.parse(await req.json());
    const record = await userService.getAvatar(user.userId);

    // Delete old avatar from Cloudinary if exists
    if (record?.profileImagePublicId) {
      cloudinary.uploader
        .destroy(record.profileImagePublicId)
        .catch(console.error);
    }
    const updated = await userService.updateAvatar(user.userId, body);
    return NextResponse.json({ success: true, data: { user: updated } });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUser(req);
    const record = await userService.getAvatar(user.userId);
    if (record?.profileImagePublicId) {
      cloudinary.uploader
        .destroy(record.profileImagePublicId)
        .catch(console.error);
    }

    await userService.deleteAvatar(user.userId);
    return NextResponse.json({ success: true, message: "Avatar removed." });
  } catch (err) {
    return handleError(err);
  }
}
