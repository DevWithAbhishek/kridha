import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { AddStoreImagesSchema } from "@/schemas";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";

const MAX_STORE_IMAGES = 5;
interface StoreImage {
  url: string;
  publicId: string;
}

export async function GET(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: user.userId },
      select: { storeImages: true },
    });
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");
    return NextResponse.json({
      success: true,
      data: { storeImages: profile.storeImages },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const body = AddStoreImagesSchema.parse(await req.json());
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: user.userId },
      select: { storeImages: true },
    });
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");

    const raw = profile.storeImages;

    const current: StoreImage[] = Array.isArray(raw)
      ? (raw as unknown as StoreImage[])
      : [];

    if (current.length + body.images.length > MAX_STORE_IMAGES) {
      throw ERR.STORE_IMAGE_LIMIT;
    }

    const updated = await prisma.sellerProfile.update({
      where: { userId: user.userId },
      data: {
        storeImages: [
          ...current,
          ...body.images,
        ] as unknown as Prisma.InputJsonValue,
      },
      select: { storeImages: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: `${body.images.length} image(s) added.`,
        data: { storeImages: updated.storeImages },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
