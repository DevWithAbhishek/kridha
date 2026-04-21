import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { paymentService } from "@/services/payment.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser(req);
    const { id } = await params;
    const result = await paymentService.createAdvance(id, user.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}
