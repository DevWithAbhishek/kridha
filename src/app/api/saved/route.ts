import { getUser } from "@/lib/get-user";
import { AddToSavedProductsSchema, GetSavedProductsSchema } from "@/schemas";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { success } from "zod";
import { handleError } from "@/lib/handleError";
import { ERR } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    const q = GetSavedProductsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const safePage = Math.max(1, q.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, q.limit ?? 20));

    const [saved, total] = await Promise.all([
      prisma.savedProduct.findMany({
        where: { userId: user.userId, ...(q.type ? { type: q.type } : {}) },
        include: {
          product: {
            include: {
              priceTiers: true,
              deals: {
                where: {
                  status: "ACTIVE",
                  expiresAt: { gt: new Date() },
                },
              },
              take: 1,
            },
          },
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.savedProduct.count({
        where: {
          userId: user.userId,
          ...(q.type ? { type: q.type } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        saved,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          hasMore: (safePage - 1) * safeLimit + saved.length < total,
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = AddToSavedProductsSchema.parse(await req.json());

    const product = await prisma.product.findUnique({
      where: {
        id: body.productId,
        productStatus: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;

    const existing = await prisma.savedProduct.findUnique({
      where: {
        userId_productId_type: {
          userId: user.userId,
          productId: body.productId,
          type: body.type,
        },
      },
    });
    if (!existing) throw ERR.ALREADY_SAVED;

    const saved = await prisma.savedProduct.create({
      data: {
        userId: user.userId,
        productId: body.productId,
        type: body.type,
      },
    });
    return NextResponse.json(
      {
        success: true,
        data: { saved },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
