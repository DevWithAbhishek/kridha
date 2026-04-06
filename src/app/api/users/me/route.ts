// GET — own profile (no pin, no raw accountNumber).
// PATCH — update name, city, preferredLang etc.
// DELETE — soft delete account if no active orders.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { EditUserProfileSchema } from "@/schemas";
import { ERR } from "@/lib/errors";
import { userService } from "@/services/user.service";

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    const record = await userService.getUserById(user.userId);
    if (!record) throw ERR.NOT_FOUND("User");
    return NextResponse.json({ success: true, data: { user: record } });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = EditUserProfileSchema.parse(await req.json());
    const updated = userService.updateUser(user.userId, body);
    return NextResponse.json({ success: true, data: { user: updated } });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUser(req);
    // Cannot delete if active orders exist
    const active = await userService.getActiveOrders(user.userId);
    if (active) throw ERR.ACCOUNT_HAS_ACTIVE_ORDERS;

    await userService.deleteUser(user.userId);
    return NextResponse.json({ success: true, message: "Account deleted." });
  } catch (err) {
    return handleError(err);
  }
}
