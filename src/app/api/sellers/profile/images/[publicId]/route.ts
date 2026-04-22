import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { Role } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { Prisma } from "@prisma/client";
import { AddStoreImagesSchema } from "@/schemas";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface StoreImage {
  url: string;
  publicId: string;
}
type ImageParams = { params: Promise<{ publicId: string }> };

export async function DELETE(req: NextRequest, { params }: ImageParams) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const { publicId: encoded } = await params;
    const publicId = decodeURIComponent(encoded);

    await prisma.$transaction(async (tx) => {
      const profile = await tx.sellerProfile.findUnique({
        where: { userId: user.userId },
        select: { storeImages: true },
      });

      if (!profile) throw ERR.NOT_FOUND("SellerProfile");

      const raw = profile.storeImages;

      const current: StoreImage[] = Array.isArray(raw)
        ? (raw as unknown as StoreImage[])
        : [];

      // optional: make delete idempotent
      const exists = current.some((img) => img.publicId === publicId);
      if (!exists) return;

      const filtered = current.filter((img) => img.publicId !== publicId);
      AddStoreImagesSchema.parse({
        images: filtered,
      });

      await tx.sellerProfile.update({
        where: { userId: user.userId },
        data: {
          storeImages: filtered as unknown as Prisma.InputJsonValue,
        },
      });
    });

    cloudinary.uploader
      .destroy(publicId)
      .catch((e) => console.error("[CLOUDINARY] delete failed:", publicId, e));

    return NextResponse.json({ success: true, message: "Image removed." });
  } catch (err) {
    return handleError(err);
  }
}
