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
