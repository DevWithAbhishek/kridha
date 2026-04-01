type Lang = "en" | "hi";
interface NotificationCopy {
  title: string;
  body: string;
}

export const notifStrings = {
  orderConfirmed: {
    en: (shortId: string, otp: string): NotificationCopy => ({
      title: "Order Confirmed",
      body: `Order ${shortId} confirmed. Your OTP: ${otp}. Show to seller at pickup.`,
    }),
    hi: (shortId: string, otp: string): NotificationCopy => ({
      title: "ऑर्डर कन्फर्म हो गया",
      body: `ऑर्डर ${shortId} कन्फर्म हुआ। आपका OTP: ${otp}। पिकअप पर विक्रेता को दिखाएं।`,
    }),
  } satisfies Record<Lang, (s: string, o: string) => NotificationCopy>,

  newOrder: {
    en: (shortId: string): NotificationCopy => ({
      title: "New Order",
      body: `Order ${shortId} confirmed. Buyer paid advance — prepare goods for pickup.`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "नया ऑर्डर",
      body: `ऑर्डर ${shortId} कन्फर्म हुआ। Buyer ने advance दिया — माल तैयार रखें।`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  readyForPickup: {
    en: (shortId: string): NotificationCopy => ({
      title: "Payment Received — Share OTP",
      body: `Order ${shortId}: full payment received. Show your OTP to the seller.`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "भुगतान मिल गया — OTP दिखाएं",
      body: `ऑर्डर ${shortId}: पूरा भुगतान मिल गया। विक्रेता को OTP दिखाएं।`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  readyForOtpSeller: {
    en: (shortId: string): NotificationCopy => ({
      title: "Buyer Ready — Request OTP",
      body: `Order ${shortId}: payment received. Ask buyer for OTP to complete pickup.`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "Buyer तैयार है — OTP लें",
      body: `ऑर्डर ${shortId}: भुगतान मिला। पिकअप पूरा करने के लिए Buyer से OTP लें।`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  orderCompleted: {
    en: (shortId: string): NotificationCopy => ({
      title: "Pickup Complete",
      body: `Order ${shortId} completed. Thank you!`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "पिकअप पूरा हुआ",
      body: `ऑर्डर ${shortId} सफलतापूर्वक पूरा हुआ। धन्यवाद!`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  payoutQueued: {
    en: (amount: number): NotificationCopy => ({
      title: "Payout Queued",
      body: `₹${amount} payout queued for today's batch transfer.`,
    }),
    hi: (amount: number): NotificationCopy => ({
      title: "Payout queue में है",
      body: `₹${amount} payout आज के batch transfer में process होगा।`,
    }),
  } satisfies Record<Lang, (n: number) => NotificationCopy>,

  orderCancelledBuyer: {
    en: (shortId: string, refund: number): NotificationCopy => ({
      title: "Order Cancelled",
      body:
        refund > 0
          ? `Order ${shortId} cancelled. ₹${refund} refund initiated.`
          : `Order ${shortId} cancelled. No refund applicable.`,
    }),
    hi: (shortId: string, refund: number): NotificationCopy => ({
      title: "ऑर्डर रद्द हुआ",
      body:
        refund > 0
          ? `ऑर्डर ${shortId} रद्द हुआ। ₹${refund} की वापसी शुरू हुई।`
          : `ऑर्डर ${shortId} रद्द हुआ। वापसी लागू नहीं है।`,
    }),
  } satisfies Record<Lang, (s: string, n: number) => NotificationCopy>,

  orderCancelledSeller: {
    en: (shortId: string): NotificationCopy => ({
      title: "Order Cancelled",
      body: `Order ${shortId} was cancelled by the buyer.`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "ऑर्डर रद्द हुआ",
      body: `ऑर्डर ${shortId} Buyer ने रद्द किया।`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  sellerCancelledBuyer: {
    en: (shortId: string): NotificationCopy => ({
      title: "Order Cancelled by Seller",
      body: `Order ${shortId} was cancelled by the seller. Full refund initiated.`,
    }),
    hi: (shortId: string): NotificationCopy => ({
      title: "विक्रेता ने ऑर्डर रद्द किया",
      body: `ऑर्डर ${shortId} विक्रेता ने रद्द किया। पूरी वापसी शुरू हुई।`,
    }),
  } satisfies Record<Lang, (s: string) => NotificationCopy>,

  refundInitiated: {
    en: (amount: number): NotificationCopy => ({
      title: "Refund Initiated",
      body: `₹${amount} refund initiated. Reflects in 5-7 business days.`,
    }),
    hi: (amount: number): NotificationCopy => ({
      title: "Refund शुरू हुआ",
      body: `₹${amount} की वापसी शुरू हो गई। 5-7 कार्य दिवसों में दिखेगी।`,
    }),
  } satisfies Record<Lang, (n: number) => NotificationCopy>,

  noShowPenalty: {
    en: (count: number): NotificationCopy => ({
      title: "No-Show Penalty",
      body: `₹20 deducted from your credit balance. No-show count: ${count}.`,
    }),
    hi: (count: number): NotificationCopy => ({
      title: "No-Show जुर्माना",
      body: `आपके credit से ₹20 काटा गया। No-show गिनती: ${count}।`,
    }),
  } satisfies Record<Lang, (n: number) => NotificationCopy>,

  accountFlagged: {
    en: (): NotificationCopy => ({
      title: "Account Restricted",
      body: "Your account is restricted due to repeated no-shows. Contact support.",
    }),
    hi: (): NotificationCopy => ({
      title: "Account प्रतिबंधित",
      body: "बार-बार no-show के कारण account restrict हुआ। Support से संपर्क करें।",
    }),
  } satisfies Record<Lang, () => NotificationCopy>,

  newReview: {
    en: (productName: string, rating: number): NotificationCopy => ({
      title: "New Review",
      body: `Your product "${productName}" received a ${rating}-star review.`,
    }),
    hi: (productName: string, rating: number): NotificationCopy => ({
      title: "नई समीक्षा",
      body: `आपके उत्पाद "${productName}" को ${rating} स्टार की समीक्षा मिली।`,
    }),
  } satisfies Record<Lang, (s: string, n: number) => NotificationCopy>,
} as const;
