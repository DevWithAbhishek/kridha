import type { OrderStatus } from "@/types/dashboard";

interface StatusConfig {
  labelHi: string;
  labelEn: string;
  bg: string;
  text: string;
  dot: string;
  border: string;
}

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  PENDING: {
    labelHi: "प्रतीक्षारत",
    labelEn: "Pending",
    bg: "bg-warning-light",
    text: "text-warning-dark",
    dot: "bg-warning",
    border: "border-warning/30",
  },
  CONFIRMED: {
    labelHi: "कन्फर्म",
    labelEn: "Confirmed",
    bg: "bg-info-light",
    text: "text-info-dark",
    dot: "bg-info",
    border: "border-info/30",
  },
  AWAITING_PAYMENT: {
    labelHi: "भुगतान बाकी",
    labelEn: "Awaiting Payment",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    border: "border-orange-200 dark:border-orange-800",
  },
  READY_FOR_OTP_VERIFICATION: {
    labelHi: "OTP सत्यापन",
    labelEn: "Ready for OTP",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
    border: "border-purple-200 dark:border-purple-800",
  },
  COMPLETED: {
    labelHi: "पूर्ण",
    labelEn: "Completed",
    bg: "bg-success-light",
    text: "text-success-dark",
    dot: "bg-success",
    border: "border-success/30",
  },
  CANCELLED: {
    labelHi: "रद्द",
    labelEn: "Cancelled",
    bg: "bg-error-light",
    text: "text-error-dark",
    dot: "bg-error",
    border: "border-error/30",
  },
  DISPUTED: {
    labelHi: "विवाद",
    labelEn: "Disputed",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
};

export function getStatusConfig(status: OrderStatus): StatusConfig {
  return STATUS_CONFIG[status];
}
