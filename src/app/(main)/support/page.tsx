"use client";
// src/app/(buyer)/support/page.tsx
// Customer support page: contact channels + FAQ accordion

import * as Accordion from "@radix-ui/react-accordion";
import {
  ChevronDown,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useLangStore } from "@/stores/langStore";

const CONTACT_CHANNELS = [
  {
    icon: "💬",
    href: "https://wa.me/919999999999",
    label: "WhatsApp",
    sub: "सबसे तेज़ जवाब",
    subEn: "Fastest response",
    bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    textCls: "text-green-700 dark:text-green-400",
    external: true,
  },
  {
    icon: "📧",
    href: "mailto:support@kridha.in",
    label: "Email",
    sub: "support@kridha.in",
    subEn: "support@kridha.in",
    bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    textCls: "text-blue-700 dark:text-blue-400",
    external: false,
  },
  {
    icon: "📞",
    href: "tel:+919999999999",
    label: "Phone",
    sub: "+91 99999 99999",
    subEn: "+91 99999 99999",
    bg: "bg-kridha-secondary dark:bg-kridha-primary/10 border-kridha-primary/30 dark:border-kridha-primary/30",
    textCls: "text-kridha-primary",
    external: false,
  },
  {
    icon: "🕐",
    href: null,
    label: null,
    sub: "सोम–शनि 9am–6pm IST",
    subEn: "Mon–Sat 9am–6pm IST",
    bg: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
    textCls: "text-muted-DEFAULT dark:text-muted-dark",
    external: false,
  },
];

const FAQS = [
  {
    q: "Order कैसे cancel करें?",
    qEn: "How do I cancel an order?",
    a: "Order detail page पर जाएं → Cancel button दबाएं। PENDING और CONFIRMED orders cancel हो सकते हैं। 24 घंटे पहले cancel करने पर 100% advance refund मिलता है।",
    aEn: "Go to the order detail page → tap Cancel. Orders in PENDING or CONFIRMED status can be cancelled. Cancelling 24h+ before pickup gives a 100% advance refund.",
  },
  {
    q: "Advance refund कब मिलेगा?",
    qEn: "When will I receive my advance refund?",
    a: "Refund 3-5 working days में Razorpay के ज़रिए आपके account में वापस मिलेगा। Timing depends on your bank.",
    aEn: "Refund arrives in 3-5 working days via Razorpay to your original payment method. Timing depends on your bank.",
  },
  {
    q: "OTP क्या है और कब इस्तेमाल करें?",
    qEn: "What is the OTP used for?",
    a: "Payment complete होने के बाद आपको एक OTP notification मिलेगा। Pickup के समय यह OTP seller को दिखाएं — इससे order COMPLETED होता है।",
    aEn: "After full payment, you receive an OTP via notification. Show this to the seller at pickup — this completes the order.",
  },
  {
    q: "Pickup window क्या होती है?",
    qEn: "What is a pickup window?",
    a: "Seller के store से product collect करने का time slot। Product add करते time आप window और date select करते हैं। उसी window में पहुंचें।",
    aEn: "A time slot to collect your product from the seller's store. You select the window and date when adding to cart. Arrive within that window.",
  },
  {
    q: "Minimum order क्यों है?",
    qEn: "Why is there a minimum order amount?",
    a: "हर seller का minimum order ₹1000 है — यह platform की policy है। इससे छोटे sellers को viable orders मिलते हैं।",
    aEn: "Each seller has a ₹1000 minimum order — this is platform policy. It ensures viable order sizes for small sellers.",
  },
  {
    q: "No-show penalty क्या है?",
    qEn: "What is a no-show penalty?",
    a: "Pickup window में नहीं आने पर ₹20 penalty और reliability score में 15 points की कमी होती है। 3+ no-shows पर account restrict हो सकता है।",
    aEn: "Missing a pickup window incurs a ₹20 penalty and -15 reliability score. 3+ no-shows may result in account restriction.",
  },
  {
    q: "Credit balance कहाँ से आता है?",
    qEn: "Where does credit balance come from?",
    a: "Kridha कभी-कभी refund या promotional credit आपके account में डालता है। Checkout पर यह automatically use होता है।",
    aEn: "Kridha occasionally adds refund credit or promotional credit to your account. It is automatically applied at checkout.",
  },
  {
    q: "Seller कैसे बनें?",
    qEn: "How do I become a seller?",
    a: 'Profile section में जाएं → "Seller बनें" option। Store details, bank info, और KYC documents submit करें। Admin 12-48 घंटों में verify करेगा।',
    aEn: 'Go to Profile → "Become a Seller". Submit store details, bank info, and KYC documents. Admin verifies within 12-48 hours.',
  },
];

export default function SupportPage() {
  const { lang } = useLangStore();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h1 className="text-h3 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "सहायता केंद्र" : "Help Centre"}
          </h1>
        </div>
        <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark ml-13">
          {lang === "hi"
            ? "हम यहाँ हैं आपकी मदद के लिए"
            : "We're here to help you"}
        </p>
      </div>

      {/* Contact channels */}
      <div>
        <h2 className="text-label-lg font-bold text-[var(--color-text)] mb-4">
          {lang === "hi" ? "हमसे संपर्क करें" : "Contact Us"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CONTACT_CHANNELS.map((ch, i) => {
            const inner = (
              <div
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${ch.bg} text-center h-full`}
              >
                <span className="text-2xl">{ch.icon}</span>
                {ch.label && (
                  <p className={`text-label-sm font-bold ${ch.textCls}`}>
                    {ch.label}
                  </p>
                )}
                <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi" ? ch.sub : ch.subEn}
                </p>
              </div>
            );
            if (!ch.href) return <div key={i}>{inner}</div>;
            return (
              <Link
                key={i}
                href={ch.href}
                target={ch.external ? "_blank" : undefined}
                rel={ch.external ? "noopener noreferrer" : undefined}
                className="block hover:scale-[1.02] transition-transform"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* FAQ accordion */}
      <div>
        <h2 className="text-label-lg font-bold text-[var(--color-text)] mb-4">
          {lang === "hi"
            ? "अक्सर पूछे जाने वाले सवाल"
            : "Frequently Asked Questions"}
        </h2>
        <Accordion.Root type="single" collapsible className="space-y-2">
          {FAQS.map((faq, i) => (
            <Accordion.Item
              key={i}
              value={`faq-${i}`}
              className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden"
            >
              <Accordion.Trigger className="flex items-center justify-between w-full px-5 py-4 text-left group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <span className="text-label-md font-semibold text-[var(--color-text)] pr-4">
                  {lang === "hi" ? faq.q : faq.qEn}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 group-data-[state=open]:rotate-180 transition-transform duration-200" />
              </Accordion.Trigger>
              <Accordion.Content className="px-5 pb-4 text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                {lang === "hi" ? faq.a : faq.aEn}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>

      {/* Still need help */}
      <div className="bg-kridha-secondary dark:bg-kridha-primary/10 border border-kridha-primary/20 dark:border-kridha-primary/30 rounded-2xl px-6 py-5 text-center">
        <p className="font-bold text-label-lg text-[var(--color-text)] mb-1">
          {lang === "hi" ? "और मदद चाहिए?" : "Still need help?"}
        </p>
        <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-4">
          {lang === "hi"
            ? "हमारी team जल्दी जवाब देती है"
            : "Our team responds quickly"}
        </p>
        <Link
          href="mailto:support@kridha.in"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-kridha-primary text-white text-label-sm font-semibold hover:bg-kridha-primary-hover transition-colors"
        >
          <Mail className="w-4 h-4" />
          {lang === "hi" ? "Email करें" : "Send Email"}
        </Link>
      </div>
    </div>
  );
}
