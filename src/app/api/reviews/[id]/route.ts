import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { UpdateReviewSchema } from "@/schemas";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";

type ReviewParams = { params: Promise<{ id: string }> };

async function reAggregateSellerRating(sellerId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { sellerId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.sellerProfile.update({
    where: { userId: sellerId },
    data: {
      sellerRating: parseFloat((agg._avg.rating ?? 0).toFixed(2)),
      sellerRatingCount: agg._count,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: ReviewParams) {
  try {
    const user = await getUser(req);
    const { id } = await params;
    const body = UpdateReviewSchema.parse(await req.json());

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ERR.REVIEW_NOT_FOUND;
    if (review.userId !== user.userId) throw ERR.FORBIDDEN;

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(body.rating !== undefined ? { rating: body.rating } : {}),
        ...(body.comment !== undefined ? { comment: body.comment } : {}),
      },
    });

    await reAggregateSellerRating(review.sellerId);

    return NextResponse.json({
      success: true,
      data: {
        review: {
          id: updated.id,
          rating: updated.rating,
          comment: updated.comment,
          updatedAt: updated.updatedAt,
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: ReviewParams) {
  try {
    const user = await getUser(req);
    const { id } = await params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ERR.REVIEW_NOT_FOUND;
    if (review.userId !== user.userId) throw ERR.FORBIDDEN;

    await prisma.review.delete({ where: { id } });
    await reAggregateSellerRating(review.sellerId);

    return NextResponse.json({ success: true, message: "Review deleted." });
  } catch (err) {
    return handleError(err);
  }
}
