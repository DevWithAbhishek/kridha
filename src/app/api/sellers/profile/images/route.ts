import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { AddStoreImagesSchema } from "@/schemas";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { sellerService } from "@/services/seller.service";

const MAX_STORE_IMAGES = 5;
interface StoreImage {
  url: string;
  publicId: string;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const profile = await sellerService.getSellerStoreImages(user.userId);
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
    const user = await requireRole(req, Role.SELLER);
    const rawBody = await req.json();
    const body = AddStoreImagesSchema.parse(rawBody);
    console.log("rawBody: ", rawBody);
    console.log("Body: ", body);
    
    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.sellerProfile.findUnique({
        where: { userId: user.userId },
        select: { storeImages: true },
      });
      if (!profile) throw ERR.NOT_FOUND("SellerProfile");

      const raw = profile.storeImages;
      const current: StoreImage[] = Array.isArray(raw)
        ? (raw as unknown as StoreImage[])
        : [];
      const merged = [...current, ...body.images];

      const unique = Array.from(
        new Map(merged.map((img) => [img.url, img])).values(),
      );
      if (unique.length > MAX_STORE_IMAGES) {
        throw ERR.STORE_IMAGE_LIMIT;
      }
      AddStoreImagesSchema.parse({
        images: unique,
      });
      return tx.sellerProfile.update({
        where: { userId: user.userId },
        data: {
          storeImages: unique as unknown as Prisma.InputJsonValue,
        },
        select: { storeImages: true },
      });
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
