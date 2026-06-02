"use client";

// ─────────────────────────────────────────────────────────────────────────────
// sections/HowIBuiltKridha.tsx + EngineeringHighlights.tsx
//
// Two standalone homepage sections for Kridha's portfolio page.
// Uses: Framer Motion, Lucide React, Tailwind (kridha design system tokens)
// Zero external dependencies beyond what Kridha already uses.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, useInView, Variants } from "framer-motion";
import {
  ShieldCheck,
  Database,
  Zap,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Lock,
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  CheckCircle2,
  KeyRound,
  FileText,
  ScanLine,
  Server,
} from "lucide-react";
import { useRef } from "react";
import Link from "next/link";

// ─── Shared animation helpers ────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

function useSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return { ref, inView };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — HOW I BUILT KRIDHA
// ─────────────────────────────────────────────────────────────────────────────

interface BuildCard {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  accent: string; // Tailwind bg class for icon background
}

const buildCards: BuildCard[] = [
  {
    icon:        <Lightbulb className="w-5 h-5" />,
    tag:         "Product Rationale",
    title:       "Why Kridha Exists",
    description:
      "Platforms like Udaan require 50 kg+ minimums to make delivery economics work. " +
      "Kridha removes the minimum order constraint by eliminating delivery entirely — " +
      "buyers self-pickup within 10 km. One constraint removed, a new market unlocked.",
    cta:         "Read the case study",
    href:        "/docs/case-study",
    accent:      "bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary",
  },
  {
    icon:        <ShieldCheck className="w-5 h-5" />,
    tag:         "Security Architecture",
    title:       "Zero-Trust Auth System",
    description:
      "HttpOnly cookie JWTs eliminate XSS token theft. Three-layer rate limiting " +
      "(per-IP → per-account → global) defeats IP rotation. Token-family rotation " +
      "detects refresh-token reuse and revokes all sessions in milliseconds.",
    cta:         "Explore security design",
    href:        "/docs/security",
    accent:      "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400",
  },
  {
    icon:        <Database className="w-5 h-5" />,
    tag:         "Backend Design",
    title:       "Correctness by Construction",
    description:
      "Order→SubOrder decomposition ensures one Razorpay advance covers all sellers " +
      "atomically while fulfillment tracks stay independent. SELECT FOR UPDATE prevents " +
      "stock oversell. Nineteen documented system invariants define what 'correct' means.",
    cta:         "Read the architecture",
    href:        "/docs/architecture",
    accent:      "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400",
  },
  {
    icon:        <Zap className="w-5 h-5" />,
    tag:         "Performance & Scaling",
    title:       "Measured, Not Claimed",
    description:
      "100 concurrent webhook deliveries → exactly 1 DB row (k6 verified). " +
      "200 concurrent reads on PostGIS radius search → 0 HTTP errors. " +
      "pg.Pool configured at max=15 (prod) with explicit timeout and fail-open Redis.",
    cta:         "View load test results",
    href:        "/docs/performance",
    accent:      "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400",
  },
];

function BuildCard({ card, index }: { card: BuildCard; index: number }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="group relative flex flex-col bg-[var(--color-surface)] dark:bg-surface-dark
                 border border-border-DEFAULT dark:border-border-dark
                 rounded-2xl p-6 overflow-hidden
                 hover:border-kridha-primary/40 hover:shadow-card-hover
                 transition-all duration-300 cursor-pointer"
    >
      {/* Subtle gradient on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-kridha-primary/[0.03] to-transparent pointer-events-none"
      />

      {/* Tag + Icon */}
      <div className="flex items-start justify-between mb-4">
        <span className="text-label-sm font-semibold text-muted-DEFAULT dark:text-muted-dark tracking-wide uppercase">
          {card.tag}
        </span>
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${card.accent}`}>
          {card.icon}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-label-lg font-bold text-[var(--color-text)] mb-3 leading-snug">
        {card.title}
      </h3>

      {/* Description */}
      <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed flex-1">
        {card.description}
      </p>

      {/* CTA */}
      <Link
        href={card.href}
        className="mt-5 inline-flex items-center gap-1.5 text-label-sm font-semibold
                   text-kridha-primary hover:text-kridha-primary-hover
                   transition-colors group/cta"
      >
        {card.cta}
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

export function HowIBuiltKridha() {
  const { ref, inView } = useSection();

  return (
    <section
      ref={ref}
      className="relative py-20 bg-background-DEFAULT dark:bg-background-dark overflow-hidden"
    >
      {/* Background decoration */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full
                        bg-kridha-primary/[0.04] dark:bg-kridha-primary/[0.07] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full
                        bg-kridha-accent/[0.05] blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section label */}
        <motion.div
          variants={fadeIn}
          custom={0}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="flex items-center gap-2 mb-4"
        >
          <span className="h-px w-8 bg-kridha-primary/60" />
          <span className="text-label-sm font-semibold text-kridha-primary tracking-widest uppercase">
            Engineering Showcase
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          variants={fadeUp}
          custom={1}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="text-h2 font-bold text-[var(--color-text)] mb-4 max-w-2xl"
        >
          How I Built Kridha
        </motion.h2>

        {/* Subheading */}
        <motion.p
          variants={fadeUp}
          custom={2}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="text-body-md text-muted-DEFAULT dark:text-muted-dark max-w-xl mb-12"
        >
          A B2B self-pickup marketplace for Tier-2 India — designed around real
          backend constraints, not a tutorial template.
        </motion.p>

        {/* Cards grid */}
        <motion.div
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {buildCards.map((card, i) => (
            <BuildCard key={card.title} card={card} index={i + 3} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — ENGINEERING HIGHLIGHTS
// ─────────────────────────────────────────────────────────────────────────────

interface Highlight {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  badge:       string;
  badgeColor:  string;
}

const highlights: Highlight[] = [
  {
    icon:        <KeyRound className="w-4 h-4" />,
    title:       "JWT Auth + HttpOnly Cookies",
    description:
      "Tokens stored in HttpOnly cookies — inaccessible to JavaScript, " +
      "eliminating XSS-based session theft. CSRF mitigated via double-submit token pattern.",
    badge:       "Security",
    badgeColor:  "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  {
    icon:        <RefreshCw className="w-4 h-4" />,
    title:       "Token Family Rotation",
    description:
      "Refresh token reuse triggers immediate family revocation — all sessions " +
      "for the user are invalidated. Detects stolen tokens without requiring user action.",
    badge:       "Auth",
    badgeColor:  "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  {
    icon:        <Database className="w-4 h-4" />,
    title:       "PostgreSQL Transactions",
    description:
      "Multi-seller checkout uses a single atomic transaction: stock decrements, " +
      "Order + SubOrder creation, and status history all commit or roll back together.",
    badge:       "Database",
    badgeColor:  "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  {
    icon:        <Lock className="w-4 h-4" />,
    title:       "SELECT FOR UPDATE Row Locking",
    description:
      "Concurrent checkout for the same product serialises through Postgres " +
      "row-level locks. Exactly one buyer succeeds; others receive a clean 409. " +
      "No application-level locks, no clock drift.",
    badge:       "Concurrency",
    badgeColor:  "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  {
    icon:        <CreditCard className="w-4 h-4" />,
    title:       "Razorpay Webhook Idempotency",
    description:
      "WebhookLog table holds a @unique constraint on razorpayPaymentId. " +
      "The handler runs inside a transaction — 100 concurrent identical deliveries " +
      "produce exactly one database write, verified with k6.",
    badge:       "Payments",
    badgeColor:  "bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary border-kridha-primary/20",
  },
  {
    icon:        <Server className="w-4 h-4" />,
    title:       "Redis Rate Limiting (3 Layers)",
    description:
      "Per-IP sliding window (5/min) → per-account using phone suffix (10/15 min) " +
      "→ global platform limiter (500/min). Defeats IP rotation at layer 2. " +
      "Fail-open: Redis down never blocks legitimate requests.",
    badge:       "Security",
    badgeColor:  "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  {
    icon:        <Activity className="w-4 h-4" />,
    title:       "GlitchTip Error Monitoring",
    description:
      "Every 5xx captures a GlitchTip event via Sentry SDK. Token theft and " +
      "credential-stuffing attempts trigger fatal-level alerts. " +
      "Error rate visible in real time — not discovered from user complaints.",
    badge:       "Observability",
    badgeColor:  "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  {
    icon:        <FileText className="w-4 h-4" />,
    title:       "Pino Structured Logging",
    description:
      "JSON logs with correlation IDs (requestId) on every request. " +
      "Fourteen sensitive fields (PIN, OTP, bank account) are redacted " +
      "automatically — logs cannot expose user credentials.",
    badge:       "Observability",
    badgeColor:  "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  {
    icon:        <ScanLine className="w-4 h-4" />,
    title:       "OTP Pickup Verification",
    description:
      "Delivery OTP generated at payment capture and stored hashed on SubOrder. " +
      "Seller verifies buyer-presented OTP to transition " +
      "READY_FOR_OTP_VERIFICATION → COMPLETED. Invalid OTPs are rejected by the state machine.",
    badge:       "Fulfilment",
    badgeColor:  "bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary border-kridha-primary/20",
  },
  {
    icon:        <BarChart3 className="w-4 h-4" />,
    title:       "Payment Reconciliation",
    description:
      "Two-phase payment split: advance at order creation, remaining via payment " +
      "link at pickup. Each phase tracked in Payment table with type and status. " +
      "Payout cron transfers only on COMPLETED + PAID — never on PENDING or DISPUTED.",
    badge:       "Payments",
    badgeColor:  "bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary border-kridha-primary/20",
  },
];

function HighlightCard({
  highlight,
  index,
}: {
  highlight: Highlight;
  index: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="group relative flex gap-4 bg-[var(--color-surface)] dark:bg-surface-dark
                 border border-border-DEFAULT dark:border-border-dark
                 rounded-2xl p-5 overflow-hidden
                 hover:border-kridha-primary/30 hover:shadow-card-hover
                 transition-all duration-300"
    >
      {/* Hover gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-kridha-primary/[0.025] to-transparent pointer-events-none"
      />

      {/* Icon column */}
      <div className="flex-shrink-0 mt-0.5">
        <span
          className="flex items-center justify-center w-8 h-8 rounded-xl
                     bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary"
        >
          {highlight.icon}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0">
        {/* Badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold
                     uppercase tracking-wide border mb-2 ${highlight.badgeColor}`}
        >
          {highlight.badge}
        </span>

        {/* Title */}
        <p className="font-bold text-label-md text-[var(--color-text)] mb-1.5 leading-snug">
          {highlight.title}
        </p>

        {/* Description */}
        <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed">
          {highlight.description}
        </p>
      </div>
    </motion.div>
  );
}

// Animated stat counter strip
interface Stat {
  value: string;
  label: string;
  sub:   string;
}

const stats: Stat[] = [
  { value: "100",   label: "Concurrent Webhooks",  sub: "→ 1 DB write (k6 verified)" },
  { value: "0",     label: "Server Errors",         sub: "across 9,702 requests @ 100 VU" },
  { value: "200",   label: "Concurrent Reads",      sub: "product feed, 0 HTTP errors" },
  { value: "19",    label: "System Invariants",      sub: "documented correctness guarantees" },
];

export function EngineeringHighlights() {
  const { ref, inView } = useSection();
  const statsRef  = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      className="relative py-20 bg-background-subtle dark:bg-background-dark overflow-hidden"
    >
      {/* Background decoration */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-px
                        bg-gradient-to-r from-transparent via-border-DEFAULT dark:via-border-dark to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-px
                        bg-gradient-to-r from-transparent via-border-DEFAULT dark:via-border-dark to-transparent" />
        <div className="absolute -top-32 right-0 w-[400px] h-[400px] rounded-full
                        bg-kridha-primary/[0.04] dark:bg-kridha-primary/[0.06] blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section label */}
        <motion.div
          variants={fadeIn}
          custom={0}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="flex items-center gap-2 mb-4"
        >
          <span className="h-px w-8 bg-kridha-primary/60" />
          <span className="text-label-sm font-semibold text-kridha-primary tracking-widest uppercase">
            Backend Credibility
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          variants={fadeUp}
          custom={1}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="text-h2 font-bold text-[var(--color-text)] mb-4 max-w-xl"
        >
          Engineering Highlights
        </motion.h2>

        <motion.p
          variants={fadeUp}
          custom={2}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="text-body-md text-muted-DEFAULT dark:text-muted-dark max-w-xl mb-12"
        >
          Production patterns applied deliberately — each decision documented,
          each claim verified.
        </motion.p>

        {/* Highlights grid: 2 columns on md+, 1 on mobile */}
        <motion.div
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-14"
        >
          {highlights.map((h, i) => (
            <HighlightCard key={h.title} highlight={h} index={i + 3} />
          ))}
        </motion.div>

        {/* Stats strip */}
        <div
          ref={statsRef}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              custom={i}
              animate={statsInView ? "visible" : "hidden"}
              initial="hidden"
              className="relative flex flex-col items-center text-center
                         bg-[var(--color-surface)] dark:bg-surface-dark
                         border border-border-DEFAULT dark:border-border-dark
                         rounded-2xl px-4 py-5 overflow-hidden
                         hover:border-kridha-primary/30 transition-colors duration-300 group"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                           bg-gradient-to-b from-kridha-primary/[0.04] to-transparent pointer-events-none"
              />

              {/* Value */}
              <span className="text-h2 font-bold text-kridha-primary leading-none mb-1 tabular-nums">
                {stat.value}
              </span>

              {/* Label */}
              <span className="text-label-sm font-semibold text-[var(--color-text)] mb-1">
                {stat.label}
              </span>

              {/* Sub */}
              <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-tight">
                {stat.sub}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA row */}
        <motion.div
          variants={fadeUp}
          custom={6}
          animate={statsInView ? "visible" : "hidden"}
          initial="hidden"
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/docs/architecture"
            className="inline-flex items-center gap-2 px-5 py-2.5
                       bg-kridha-primary text-white font-semibold text-label-md
                       rounded-xl hover:bg-kridha-primary-hover transition-colors shadow-btn-primary"
          >
            Read the architecture
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://github.com/DevWithAbhishek/kridha"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5
                       border border-border-DEFAULT dark:border-border-dark
                       text-[var(--color-text)] font-semibold text-label-md
                       rounded-xl hover:border-kridha-primary hover:text-kridha-primary
                       transition-colors"
          >
            View on GitHub
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
