import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";

export function handleError(err: unknown): NextResponse {
  // Known application error — return its shape directly
  if (err instanceof AppError) {
    // 5xx AppErrors are unexpected — log them
    if (err.statusCode >= 500) {
      logger.error({ code: err.code, err }, "AppError 5xx — unexpected");
    }
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
  // err.issues in Zod v4, not err.errors
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_FAILED",
        message: "Validation failed. Please check your input.",
        meta: err.issues,
      },
      { status: 422 },
    );
  }

  // Unhandled error — log with Pino (goes to Vercel log drain)
  // GlitchTip SDK captures this automatically via its Next.js integration
  logger.error({ err }, "Unhandled error in route handler");

  return NextResponse.json(
    {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
    { status: 500 },
  );
}
