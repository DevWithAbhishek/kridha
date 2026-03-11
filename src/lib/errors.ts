export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly meta?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    meta?: unknown,
  ) {
    super(message);

    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ERR = {
  PHONE_EXISTS: () =>
    new AppError("PHONE_EXISTS", "Phone already registered", 409),

  INVALID_CREDENTIALS: () =>
    new AppError("INVALID_CREDENTIALS", "Invalid phone or PIN", 401),

  PIN_LOCKED: () =>
    new AppError("PIN_LOCKED", "Too many attempts. Try again in 30 min", 429),

  INSUFFICIENT_STOCK: (meta?: unknown) =>
    new AppError("INSUFFICIENT_STOCK", "Not enough stock", 409, meta),

  INVALID_TRANSITION: (meta?: unknown) =>
    new AppError("INVALID_TRANSITION", "Invalid state transition", 409, meta),

  INVALID_OTP: () => new AppError("INVALID_OTP", "Invalid or expired OTP", 400),

  OTP_ATTEMPTS: () =>
    new AppError("OTP_ATTEMPTS", "Too many OTP attempts", 429),

  FORBIDDEN: () => new AppError("FORBIDDEN", "Access denied", 403),

  NOT_FOUND: (resource: string) =>
    new AppError("NOT_FOUND", `${resource} not found`, 404),

  RATE_LIMITED: () => new AppError("RATE_LIMITED", "Too many requests", 429),
} as const;
