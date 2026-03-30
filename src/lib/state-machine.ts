import { OrderStatus } from "@prisma/client";
import { AppError } from "./errors";

// State machine for SubOrder.status
// PENDING → CONFIRMED            (payment.captured webhook only — INV-11)
// CONFIRMED → AWAITING_PAYMENT   (seller calls request-payment)
// AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION (payment_link.paid webhook)
// READY_FOR_OTP_VERIFICATION → COMPLETED | DISPUTED
// PENDING | CONFIRMED → CANCELLED (buyer or seller)
// COMPLETED | CANCELLED | DISPUTED — terminal, no outgoing edges (INV-02)
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["READY_FOR_OTP_VERIFICATION"],
  READY_FOR_OTP_VERIFICATION: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [],
};

// Defines a finite state machine (FSM) as a lookup table mapping each order status to its allowed next states. Record<K, V> ensures type-safe mapping for all enum value. Each key → array of valid transitions. Acts as a centralized state transition graph.
export function validateTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "INVALID_TRANSITION",
      "This status transition is not allowed.",
      409,
      {
        currentStatus: from,
        attemptedStatus: to,
        allowedTransition: TRANSITIONS[from],
      },
    );
  }
}

//Determines if a status is terminal (no further transitions possible) by checking if its transition list is empty.
export const isTerminal = (s: OrderStatus): boolean =>
  TRANSITIONS[s].length === 0;

// Checks if an order can be cancelled based on predefined cancellable states.
export const isCancellable = (s: OrderStatus): boolean =>
  ["PENDING", "CONFIRMED"].includes(s);
