// src/app/api/upload/destroy/route.ts
// Deletes a Cloudinary asset by publicId. Called when seller removes a product image.
// Only the authenticated seller who owns the product can delete its images.
// Cloudinary API secret never goes to the client.

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { z } from "zod";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DestroySchema = z.object({
  publicId: z.string().min(1).max(256),
});

export async function DELETE(req: NextRequest) {
  try {
    await getUser(req); // auth required

    const { publicId } = DestroySchema.parse(await req.json());

    // Security: only allow deletion of assets inside kridha/ folder
    if (!publicId.startsWith("kridha/")) {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", message: "Cannot delete assets outside kridha folder." },
        { status: 403 },
      );
    }

    const result = await cloudinary.uploader.destroy(publicId);
    // result.result === "ok" on success, "not found" if already deleted
    return NextResponse.json({ success: true, data: { result: result.result } });
  } catch (err) {
    return handleError(err);
  }
}
