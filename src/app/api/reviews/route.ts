import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { GetReviewsSchema, AddReviewSchema } from "@/schemas";
import { notificationService } from "@/services/notification.service";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const q = GetReviewsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const safePage = Math.max(1, q.page ?? 1);
    const safeLimit = Math.min(50, Math.max(1, q.limit ?? 20));
    const whereClause = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.sellerId ? { sellerId: q.sellerId } : {}),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true } },
          // nameHi returned so frontend can show product name in buyer's language
          product: { select: { nameEn: true, nameHi: true } },
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          hasMore: (safePage - 1) * safeLimit + reviews.length < total,
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = AddReviewSchema.parse(await req.json());

    // INV-15: SubOrder must be COMPLETED, caller must be the buyer
    const subOrder = await prisma.subOrder.findUnique({
      where: { id: body.subOrderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!subOrder || subOrder.status !== "COMPLETED") throw ERR.FORBIDDEN;
    if (subOrder.order.buyerId !== user.userId) throw ERR.FORBIDDEN;

    // Reviewed product must be in this SubOrder
    const orderItem = await prisma.orderItem.findFirst({
      where: { subOrderId: body.subOrderId, productId: body.productId },
    });
    if (!orderItem) throw ERR.FORBIDDEN;

    // INV-16: one review per product per SubOrder
    const existing = await prisma.review.findUnique({
      where: {
        subOrderId_productId: {
          subOrderId: body.subOrderId,
          productId: body.productId,
        },
      },
    });
    if (existing) throw ERR.REVIEW_ALREADY_EXISTS;

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { sellerId: true, nameEn: true, nameHi: true },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;

    const review = await prisma.review.create({
      data: {
        subOrderId: body.subOrderId,
        productId: body.productId,
        userId: user.userId,
        sellerId: product.sellerId, // denormalised for GET /reviews?sellerId= (schema comment)
        rating: body.rating,
        comment: body.comment ?? null,
      },
    });

    // Update seller's running average rating
    const agg = await prisma.review.aggregate({
      where: { sellerId: product.sellerId },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.sellerProfile.update({
      where: { userId: product.sellerId },
      data: {
        sellerRating: parseFloat((agg._avg.rating ?? 0).toFixed(2)),
        sellerRatingCount: agg._count,
      },
    });

    // Notify seller — use nameHi if seller prefers Hindi
    const sellerUser = await prisma.user.findUnique({
      where: { id: product.sellerId },
      select: { preferredLang: true },
    });
    const productName =
      sellerUser?.preferredLang === "hi" && product.nameHi
        ? product.nameHi
        : product.nameEn;

    notificationService
      .newReview(product.sellerId, productName, body.rating)
      .catch(console.error);

    return NextResponse.json(
      { success: true, message: "Review added.", data: { review } },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
