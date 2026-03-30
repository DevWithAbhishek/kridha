import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

export const orderRepo = {
  // Fetch single Suborder with full joins for detailview
  async findSubOrderById(id: string) {
    return prisma.subOrder.findUnique({
      where: { id },
      // Aggregates multiple relations (order, items, history, seller, pickup) into a single query response. Prisma internally generates optimized JOINs / batched queries to avoid N+1 issues.
      include: {
        order: { select: { id: true, buyerId: true, totalAmount: true } }, // fetches only specific fields (id, buyerId, totalAmount) from the related order.
        orderItems: {
          include: {
            product: { select: { nameEn: true, nameHi: true, unit: true } },
          },
        }, // Loads order items and joins each item with its product details (name + unit). Nested include performs relation traversal (subOrder → orderItems → product).
        statusHistory: { orderBy: { createdAt: "asc" } },
        pickupWindow: true,
        seller: {
          select: {
            userId: true,
            storeName: true,
            reliabilityScore: true,
            user: { select: { id: true, name: true } },
          },
        }, //Fetches selected seller fields along with nested user info (id, name). Uses deep selective projection to optimize nested relation payload.
      },
    });
  },

  // List SubOrders for a user — buyer sees placed orders, seller sees received orders
  async listSubOrders(
    userId: string,
    filters: {
      status?: OrderStatus;
      page: number;
      limit: number;
      sortBy: "created_asc" | "created_desc";
    },
  ) {
    const { status, page, limit, sortBy } = filters;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

      // Filters subOrders where user is either buyer or seller, optionally by status. Constructs a dynamic where clause that combines OR conditions for buyer/seller roles and an optional status filter. This allows a single query to serve both buyer and seller views with flexible filtering.
    const where = {
      OR: [{ order: { buyerId: userId } }, { sellerId: userId }],
      ...(status ? { status } : {}),
    };

    const [subOrders, total] = await Promise.all([
      prisma.subOrder.findMany({
        where,
        // Aggregates multiple relations (order, items, pickup, seller) into one structured response. Prisma optimizes this with JOINs / batching to avoid N+1 query issues. Each include fetches only necessary fields to minimize payload size.
        include: {
          order: { select: { id: true, buyerId: true } },
          orderItems: {
            include: { product: { select: { nameEn: true } } },
            take: 5,
          }, // Fetches up to 5 order items per subOrder and includes each item's product name.
          pickupWindow: {
            select: {
              labelEn: true,
              labelHi: true,
              startTime: true,
              endTime: true,
            },
          }, // Retrieves only specific pickup window fields (labels + timings).
          seller: {
            select: { storeName: true, user: { select: { name: true } } }, // Fetches seller’s store name along with user’s name via nested relation.
          },
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: sortBy === "created_asc" ? "asc" : "desc" },
      }),
      prisma.subOrder.count({ where }), // Counts total subOrders matching filters without fetching actual rows.
    ]);

    return {
      subOrders,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        hasMore: (safePage - 1) * safeLimit + subOrders.length < total,
      },
    };
  },
};
