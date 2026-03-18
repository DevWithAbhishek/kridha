// src/lib/handleError.ts

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export function handleError(err: unknown): NextResponse {
  // Known application error — return its shape directly
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        code: err.code,
        message: err.message,
        ...(err.meta !== undefined ? { meta: err.meta } : {}),
      },
      { status: err.statusCode },
    );
  }

  // Zod validation error — convert to 422 VALIDATION_FAILED
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_FAILED",
        message: "Validation failed. Please check your input.",
        meta: err.issues, // ← err.issues in Zod v4, not err.errors
      },
      { status: 422 },
    );
  }

  // Unknown error — log it, return generic 500
  // Sentry.captureException(err) ← uncomment on Day 10
  console.error("[UNHANDLED ERROR]", err);
  return NextResponse.json(
    {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
    { status: 500 },
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER TEMPLATE — copy-paste into every route file (Days 4–9)
// Replace: SomeSchema, someService.doSomething, result, 200/201
// ─────────────────────────────────────────────────────────────────────────

// import { NextRequest, NextResponse } from "next/server";
// import { handleError } from "@/lib/handleError";
// import { authenticate } from "@/lib/authenticate";
// import { authorize } from "@/lib/authorize";
// import { SomeSchema } from "@/schemas";
// import { someService } from "@/services/some.service";
//
// // GET — no body, query params only
// export async function GET(req: NextRequest) {
//   try {
//     const user = await authenticate(req);
//     // authorize(user, "SELLER");  ← uncomment if role-restricted
//
//     const { searchParams } = new URL(req.url);
//     const query = SomeSchema.parse(Object.fromEntries(searchParams));
//
//     const result = await someService.getAll(user.id, query);
//     return NextResponse.json({ success: true, data: result }, { status: 200 });
//   } catch (err) {
//     return handleError(err);
//   }
// }
//
// // POST — JSON body
// export async function POST(req: NextRequest) {
//   try {
//     const user = await authenticate(req);
//     // authorize(user, "SELLER");  ← uncomment if role-restricted
//
//     const body = SomeSchema.parse(await req.json());
//
//     const result = await someService.create(user.id, body);
//     return NextResponse.json({ success: true, data: result }, { status: 201 });
//   } catch (err) {
//     return handleError(err);
//   }
// }
//
// // PATCH — JSON body, path param
// export async function PATCH(
//   req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const user = await authenticate(req);
//
//     const body = SomeSchema.parse(await req.json());
//
//     const result = await someService.update(user.id, params.id, body);
//     return NextResponse.json({ success: true, data: result }, { status: 200 });
//   } catch (err) {
//     return handleError(err);
//   }
// }
//
// // DELETE — no body, path param
// export async function DELETE(
//   req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const user = await authenticate(req);
//
//     await someService.remove(user.id, params.id);
//     return NextResponse.json(
//       { success: true, message: "Deleted successfully." },
//       { status: 200 }
//     );
//   } catch (err) {
//     return handleError(err);
//   }
// }