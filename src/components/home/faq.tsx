"use client"
import { motion, useInView, type Variants } from "framer-motion";
import { useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MessageCircleQuestion, Phone } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

const FAQS = [
  {
    id: "q1",
    question: "How does Kridha work?",
    answer:
      "Open the app, find nearby suppliers selling what you need, and place an order — all in a few taps. " +
      "You pay a small advance online to confirm your slot. Then go to the supplier's location, inspect the goods, " +
      "pay the remaining balance, and collect. No delivery wait. No minimum order.",
  },
  {
    id: "q2",
    question: "Is my payment secure?",
    answer:
      "Yes. All payments are processed by Razorpay, one of India's most trusted payment gateways. " +
      "Your advance is held securely until you complete the pickup. " +
      "You never pay the full amount before seeing the goods in person.",
  },
  {
    id: "q3",
    question: "How are sellers verified?",
    answer:
      "Every seller on Kridha goes through PAN and bank verification before they can list a single product. " +
      "Sellers who cancel orders or receive disputes lose reliability points. " +
      "Only verified, reliable sellers stay visible on the platform.",
  },
  {
    id: "q4",
    question: "What if the goods don't match what was listed?",
    answer:
      "If the goods don't match the listing when you arrive, you can refuse the pickup on the spot. " +
      "Your advance is refunded in full within 3–5 business days. " +
      "You never have to accept goods you are not satisfied with.",
  },
  {
    id: "q5",
    question: "Can I cancel my order?",
    answer:
      "Yes, you can cancel before the pickup window. If you cancel more than 24 hours before pickup, " +
      "you get a full refund. Cancellations between 2–24 hours return 50%. " +
      "If a seller cancels, you always get 100% back — no questions asked.",
  },
  {
    id: "q6",
    question: "How do refunds work?",
    answer:
      "Refunds are processed to your original payment method within 3–5 business days. " +
      "You can track refund status directly in the app under My Orders. " +
      "If you face any issue, our support team resolves refund disputes within 24 hours.",
  },
  {
    id: "q7",
    question: "Which cities and areas are supported?",
    answer:
      "Kridha is currently live across Gorakhpur, Deoria, and Basti in Uttar Pradesh. " +
      "We are expanding to more Tier-2 cities in UP through 2025. " +
      "Enter your location in the app to see all available suppliers within 10 km of you.",
  },
];

export function KridhaFAQ() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="py-20 bg-background-DEFAULT dark:bg-background-dark"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            variants={fadeUp}
            custom={0}
            animate={inView ? "visible" : "hidden"}
            initial="hidden"
            className="flex items-center justify-center gap-2 mb-4"
          >
            <span className="h-px w-8 bg-kridha-primary/60" />
            <span className="text-[10px] font-bold text-kridha-primary tracking-[0.18em] uppercase">
              Common Questions
            </span>
            <span className="h-px w-8 bg-kridha-primary/60" />
          </motion.div>

          <motion.h2
            variants={fadeUp}
            custom={1}
            animate={inView ? "visible" : "hidden"}
            initial="hidden"
            className="text-h2 font-bold text-[var(--color-text)] mb-3"
          >
            Everything you need to know
          </motion.h2>

          <motion.p
            variants={fadeUp}
            custom={2}
            animate={inView ? "visible" : "hidden"}
            initial="hidden"
            className="text-body-sm text-muted-DEFAULT dark:text-muted-dark"
          >
            Can't find your answer?{" "}
            <a
              href="mailto:support@kridha.in"
              className="text-kridha-primary font-semibold hover:underline underline-offset-2"
            >
              Write to us
            </a>{" "}
            — we reply within 24 hours.
          </motion.p>
        </div>

        {/* Accordion */}
        <motion.div
          variants={fadeUp}
          custom={3}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
        >
          <Accordion type="single" collapsible className="flex flex-col gap-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="rounded-2xl border border-border-DEFAULT dark:border-border-dark
                           bg-[var(--color-surface)] dark:bg-surface-dark
                           overflow-hidden px-5
                           data-[state=open]:border-kridha-primary/30
                           transition-colors duration-200"
              >
                <AccordionTrigger
                  className="flex items-center gap-3 py-4 text-left
                             hover:no-underline group"
                >
                  <MessageCircleQuestion
                    className="w-4 h-4 flex-shrink-0 text-kridha-primary
                               group-data-[state=open]:text-kridha-primary"
                    aria-hidden
                  />
                  <span
                    className="text-label-md font-semibold text-[var(--color-text)]
                               group-data-[state=open]:text-kridha-primary
                               transition-colors duration-150"
                  >
                    {faq.question}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="pb-4 pl-7">
                  <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          variants={fadeUp}
          custom={4}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3
                     p-5 rounded-2xl
                     bg-kridha-secondary/50 dark:bg-kridha-primary/[0.06]
                     border border-kridha-primary/20"
        >
          <p className="text-label-sm text-[var(--color-text)] font-medium text-center sm:text-left">
            Still have questions? Our team is available Mon – Sat, 9 AM to 7 PM.
          </p>
          <a
            href="tel:+918000000000"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2
                       bg-kridha-primary text-white font-semibold text-label-sm
                       rounded-xl hover:bg-kridha-primary-hover transition-colors
                       shadow-btn-primary"
          >
            <Phone className="w-3.5 h-3.5" />
            Call Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}
