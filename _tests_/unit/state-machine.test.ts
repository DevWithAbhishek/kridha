import {
  validateTransition,
  isTerminal,
  isCancellable,
} from "@/lib/state-machine";
import { OrderStatus } from "@prisma/client";

describe("validateTransition", () => {
  it("allows PENDING → CONFIRMED", () =>
    expect(() => validateTransition("PENDING", "CONFIRMED")).not.toThrow());
  it("allows PENDING → CANCELLED", () =>
    expect(() => validateTransition("PENDING", "CANCELLED")).not.toThrow());
  it("allows CONFIRMED → AWAITING_PAYMENT", () =>
    expect(() =>
      validateTransition("CONFIRMED", "AWAITING_PAYMENT"),
    ).not.toThrow());
  it("allows CONFIRMED → CANCELLED", () =>
    expect(() => validateTransition("CONFIRMED", "CANCELLED")).not.toThrow());
  it("allows AWAITING_PAYMENT → READY_FOR_OTP", () =>
    expect(() =>
      validateTransition("AWAITING_PAYMENT", "READY_FOR_OTP_VERIFICATION"),
    ).not.toThrow());
  it("allows READY_FOR_OTP → COMPLETED", () =>
    expect(() =>
      validateTransition("READY_FOR_OTP_VERIFICATION", "COMPLETED"),
    ).not.toThrow());
  it("allows READY_FOR_OTP → DISPUTED", () =>
    expect(() =>
      validateTransition("READY_FOR_OTP_VERIFICATION", "DISPUTED"),
    ).not.toThrow());

  it("throws on COMPLETED → any", () =>
    expect(() => validateTransition("COMPLETED", "PENDING")).toThrow(
      "INVALID_TRANSITION",
    ));
  it("throws on CANCELLED → any", () =>
    expect(() => validateTransition("CANCELLED", "CONFIRMED")).toThrow(
      "INVALID_TRANSITION",
    ));
  it("throws on DISPUTED → any", () =>
    expect(() => validateTransition("DISPUTED", "COMPLETED")).toThrow(
      "INVALID_TRANSITION",
    ));
  it("throws on PENDING → COMPLETED (skip)", () =>
    expect(() => validateTransition("PENDING", "COMPLETED")).toThrow(
      "INVALID_TRANSITION",
    ));
  it("throws on AWAITING_PAYMENT → CONFIRMED", () =>
    expect(() => validateTransition("AWAITING_PAYMENT", "CONFIRMED")).toThrow(
      "INVALID_TRANSITION",
    ));

  it("error contains currentStatus in meta", () => {
    try {
      validateTransition("COMPLETED", "PENDING");
      fail("should have thrown");
    } catch (e) {
      const err = e as { meta: { currentStatus: OrderStatus } };
      expect(err.meta.currentStatus).toBe("COMPLETED");
    }
  });
});

describe("isTerminal", () => {
  it("COMPLETED is terminal", () => expect(isTerminal("COMPLETED")).toBe(true));
  it("CANCELLED is terminal", () => expect(isTerminal("CANCELLED")).toBe(true));
  it("DISPUTED is terminal", () => expect(isTerminal("DISPUTED")).toBe(true));
  it("PENDING is not terminal", () =>
    expect(isTerminal("PENDING")).toBe(false));
  it("CONFIRMED is not terminal", () =>
    expect(isTerminal("CONFIRMED")).toBe(false));
});

describe("isCancellable", () => {
  it("PENDING is cancellable", () =>
    expect(isCancellable("PENDING")).toBe(true));
  it("CONFIRMED is cancellable", () =>
    expect(isCancellable("CONFIRMED")).toBe(true));
  it("AWAITING_PAYMENT is not", () =>
    expect(isCancellable("AWAITING_PAYMENT")).toBe(false));
  it("READY_FOR_OTP_VERIFICATION is not", () =>
    expect(isCancellable("READY_FOR_OTP_VERIFICATION")).toBe(false));
  it("COMPLETED is not", () => expect(isCancellable("COMPLETED")).toBe(false));
});
