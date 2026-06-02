"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ArchitecturePreview.tsx + SecurityHighlights.tsx
// Two homepage sections for Kridha's portfolio page.
// Framer Motion · Lucide React · Tailwind (kridha design system)
// ─────────────────────────────────────────────────────────────────────────────

import {
  motion,
  useInView,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import {
  Monitor,
  Layers,
  Cpu,
  HardDrive,
  DatabaseZap,
  ArrowDown,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Webhook,
  ScanLine,
  Gauge,
  Lock,
  Cookie,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

// ─── Shared ──────────────────────────────────────────────────────────────────

function useSectionView() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return { ref, inView };
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="h-px w-8 bg-kridha-primary/60" />
    <span className="text-[10px] font-bold text-kridha-primary tracking-[0.18em] uppercase">
      {children}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — ARCHITECTURE PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

interface Layer {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  tech: string[];
  color: string; // ring / accent color class
}

const LAYERS: Layer[] = [
  {
    id: "frontend",
    icon: <Monitor className="w-4 h-4" />,
    label: "Frontend",
    sublabel: "Next.js 16 · React · Tailwind",
    tech: ["App Router", "TanStack Query", "Framer Motion", "PWA"],
    color: "text-blue-500 dark:text-blue-400",
  },
  {
    id: "api",
    icon: <Layers className="w-4 h-4" />,
    label: "API Layer",
    sublabel: "Next.js Route Handlers · Middleware",
    tech: ["JWT Auth", "Rate Limiting", "CSRF Guard", "Zod Validation"],
    color: "text-kridha-primary",
  },
  {
    id: "services",
    icon: <Cpu className="w-4 h-4" />,
    label: "Service Layer",
    sublabel: "Business logic · Domain rules",
    tech: [
      "Order State Machine",
      "Payment Flow",
      "Expiry Logic",
      "Notifications",
    ],
    color: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "repos",
    icon: <HardDrive className="w-4 h-4" />,
    label: "Repository Layer",
    sublabel: "Data access · Cache-aside",
    tech: ["ProductRepo", "OrderRepo", "Raw PostGIS SQL", "withCache"],
    color: "text-purple-500 dark:text-purple-400",
  },
  {
    id: "data",
    icon: <DatabaseZap className="w-4 h-4" />,
    label: "Data Layer",
    sublabel: "PostgreSQL + Redis",
    tech: [
      "PostGIS · GIST Index",
      "Prisma 7 + PrismaPg",
      "Upstash Redis",
      "Connection Pool",
    ],
    color: "text-emerald-500 dark:text-emerald-400",
  },
];

function LayerNode({
  layer,
  index,
  active,
  onHover,
}: {
  layer: Layer;
  index: number;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index + 2}
      onMouseEnter={() => onHover(layer.id)}
      onMouseLeave={() => onHover(null)}
      className={`
        relative flex items-start gap-4 p-4 rounded-2xl cursor-default
        border transition-all duration-300 select-none
        ${
          active
            ? "bg-[var(--color-surface)] dark:bg-surface-dark border-kridha-primary/40 shadow-card-hover"
            : "bg-[var(--color-surface)] dark:bg-surface-dark border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary/25"
        }
      `}
    >
      {/* Left accent bar */}
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-kridha-primary origin-center"
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <span className={`mt-0.5 flex-shrink-0 ${layer.color}`}>
        {layer.icon}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-label-md text-[var(--color-text)]">
            {layer.label}
          </span>
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            {layer.sublabel}
          </span>
        </div>

        {/* Tech chips — visible on hover */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap gap-1.5 mt-2 overflow-hidden"
            >
              {layer.tech.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold
                             bg-kridha-secondary dark:bg-kridha-primary/10
                             text-kridha-primary border border-kridha-primary/20"
                >
                  {t}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Animated connector between layers
function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center items-center py-1" aria-hidden>
      <div className="relative flex flex-col items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: active ? [0.3, 1, 0.3] : 0.25 }}
            transition={
              active ? { duration: 1.2, delay: i * 0.15, repeat: Infinity } : {}
            }
            className="w-0.5 h-1.5 rounded-full bg-kridha-primary"
          />
        ))}
        <ArrowDown
          className={`w-3 h-3 transition-colors duration-300 ${
            active
              ? "text-kridha-primary"
              : "text-border-DEFAULT dark:text-border-dark"
          }`}
        />
      </div>
    </div>
  );
}

export function ArchitecturePreview() {
  const { ref, inView } = useSectionView();
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  return (
    <section
      ref={ref}
      className="relative py-20 bg-background-DEFAULT dark:bg-background-dark overflow-hidden"
    >
      {/* Background blobs */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full
                        bg-kridha-primary/[0.04] dark:bg-kridha-primary/[0.07] blur-3xl -translate-y-1/3 translate-x-1/3"
        />
        <div
          className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full
                        bg-kridha-accent/[0.05] blur-3xl translate-y-1/4 -translate-x-1/4"
        />
        {/* Faint grid */}
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#2A9D8F 1px, transparent 1px),
                              linear-gradient(90deg, #2A9D8F 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Two-column layout: header left, flow right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* ── LEFT: header + description + CTA ── */}
          <div className="lg:sticky lg:top-24">
            <motion.div
              variants={fadeUp}
              custom={0}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
            >
              <SectionLabel>System Design</SectionLabel>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              custom={1}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
              className="text-h2 font-bold text-[var(--color-text)] mb-4"
            >
              Architecture
              <br />
              <span className="text-kridha-primary">Preview</span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              custom={2}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
              className="text-body-sm text-muted-DEFAULT dark:text-muted-dark mb-6 max-w-sm leading-relaxed"
            >
              Five distinct layers — each with a single responsibility. Hover
              each layer to see the key components it owns.
            </motion.p>

            {/* Quick legend */}
            <motion.div
              variants={fadeUp}
              custom={3}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
              className="flex flex-col gap-2 mb-8"
            >
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  onMouseEnter={() => setActiveLayer(l.id)}
                  onMouseLeave={() => setActiveLayer(null)}
                  className={`flex items-center gap-2.5 text-left rounded-xl px-3 py-2
                              transition-colors duration-200 w-full
                              ${
                                activeLayer === l.id
                                  ? "bg-kridha-secondary dark:bg-kridha-primary/10"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
                              }`}
                >
                  <span className={`${l.color} flex-shrink-0`}>{l.icon}</span>
                  <span className="text-label-sm font-semibold text-[var(--color-text)]">
                    {l.label}
                  </span>
                </button>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={4}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
            >
              <Link
                href="/docs/architecture"
                className="inline-flex items-center gap-2 px-5 py-2.5
                           bg-kridha-primary text-white font-semibold text-label-md
                           rounded-xl hover:bg-kridha-primary-hover transition-colors
                           shadow-btn-primary group"
              >
                Explore Full Architecture
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>

          {/* ── RIGHT: animated layer flow ── */}
          <motion.div
            animate={inView ? "visible" : "hidden"}
            initial="hidden"
            className="flex flex-col"
          >
            {LAYERS.map((layer, i) => (
              <div key={layer.id}>
                <LayerNode
                  layer={layer}
                  index={i}
                  active={activeLayer === layer.id}
                  onHover={setActiveLayer}
                />
                {i < LAYERS.length - 1 && (
                  <Connector
                    active={
                      activeLayer === layer.id ||
                      activeLayer === LAYERS[i + 1].id
                    }
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — SECURITY HIGHLIGHTS
// ─────────────────────────────────────────────────────────────────────────────

interface SecurityItem {
  icon: React.ReactNode;
  title: string;
  protection: string;
  threat: string;
  category: "Auth" | "Payments" | "Network" | "Input" | "Session";
}

const SECURITY_ITEMS: SecurityItem[] = [
  {
    icon: <Lock className="w-4 h-4" />,
    title: "JWT Verification",
    protection:
      "Explicit HS256 algorithm + expiry validation on every protected route via `jwt.verify()` with `algorithms: ['HS256']`.",
    threat:
      "Algorithm confusion attacks (e.g. RS256/HS256 swap). Unsigned or expired tokens accepted as valid.",
    category: "Auth",
  },
  {
    icon: <RefreshCw className="w-4 h-4" />,
    title: "Refresh Token Rotation",
    protection:
      "Token family tracking. On reuse detection, all sessions for that user are immediately revoked.",
    threat:
      "Stolen refresh token used by attacker after legitimate user has already rotated. Silent session hijack.",
    category: "Session",
  },
  {
    icon: <Webhook className="w-4 h-4" />,
    title: "HMAC Webhook Verification",
    protection:
      "`crypto.timingSafeEqual()` compares HMAC-SHA256 signature. Always returns 200 — invalid signatures are silently logged to prevent retry storms.",
    threat:
      "Spoofed Razorpay events confirming unpaid orders. Timing attacks leaking signature bytes via early-exit string comparison.",
    category: "Payments",
  },
  {
    icon: <ScanLine className="w-4 h-4" />,
    title: "OTP Verification",
    protection:
      "Delivery OTP stored hashed on SubOrder. State machine enforces READY_FOR_OTP → COMPLETED. Invalid OTPs rejected before DB write.",
    threat:
      "Buyer collecting goods without paying remaining amount. OTP brute-force bypassing pickup gate.",
    category: "Auth",
  },
  {
    icon: <Gauge className="w-4 h-4" />,
    title: "Three-Layer Rate Limiting",
    protection:
      "Per-IP (5/min) → per-account using phone suffix (10/15 min) → global platform (500/min). Fail-open on Redis failure.",
    threat:
      "Credential stuffing via IP rotation defeated at layer 2. Distributed brute-force capped at layer 3.",
    category: "Network",
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    title: "OWASP Controls",
    protection:
      "CSP with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. HSTS preload (63 072 000s). X-Content-Type-Options, Referrer-Policy.",
    threat:
      "Clickjacking via iframe embedding. MIME-type sniffing. Protocol downgrade. Base-tag hijacking for open redirect.",
    category: "Network",
  },
  {
    icon: <Cookie className="w-4 h-4" />,
    title: "Secure HttpOnly Cookies",
    protection:
      "JWTs stored in HttpOnly cookies — inaccessible to JavaScript. CSRF double-submit token validates every mutating request.",
    threat:
      "XSS scripts reading `localStorage` and exfiltrating JWT. CSRF forcing authenticated state-changing requests from attacker-controlled pages.",
    category: "Session",
  },
  {
    icon: <ClipboardCheck className="w-4 h-4" />,
    title: "Input Validation",
    protection:
      "`safeString` Zod transform strips HTML from all user string inputs at the API boundary before reaching service layer.",
    threat:
      "Stored XSS via product name or seller store name rendered to other users. HTML injection in notification content.",
    category: "Input",
  },
];

const CATEGORY_COLORS: Record<SecurityItem["category"], string> = {
  Auth: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  Payments:
    "bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary border-kridha-primary/25",
  Network:
    "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Input:
    "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  Session:
    "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

function SecurityCard({ item, index }: { item: SecurityItem; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={fadeUp}
      custom={index + 3}
      onClick={() => setExpanded((p) => !p)}
      className="group relative rounded-2xl border border-border-DEFAULT dark:border-border-dark
                 bg-[var(--color-surface)] dark:bg-surface-dark
                 hover:border-kridha-primary/30 hover:shadow-card-hover
                 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                      bg-gradient-to-br from-kridha-primary/[0.025] to-transparent pointer-events-none"
      />

      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <span
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl
                         bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary mt-0.5"
        >
          {item.icon}
        </span>

        {/* Title + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-label-md text-[var(--color-text)]">
              {item.title}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold
                             uppercase tracking-wider border ${CATEGORY_COLORS[item.category]}`}
            >
              {item.category}
            </span>
          </div>

          {/* Protection row */}
          <div className="flex items-start gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-DEFAULT flex-shrink-0 mt-0.5" />
            <p className="text-label-sm text-[var(--color-text)] leading-relaxed">
              {item.protection}
            </p>
          </div>
        </div>
      </div>

      {/* Threat row — always visible but collapsible depth */}
      <div
        className="px-4 pb-4 flex items-start gap-1.5 border-t border-border-DEFAULT dark:border-border-dark
                   bg-error-light/50 dark:bg-error/[0.04]"
      >
        <XCircle className="w-3.5 h-3.5 text-error-DEFAULT flex-shrink-0 mt-2" />
        <div className="min-w-0 pt-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-error-DEFAULT mb-0.5">
            Threat Prevented
          </p>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark leading-relaxed">
            {item.threat}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function SecurityHighlights() {
  const { ref, inView } = useSectionView();

  return (
    <section
      ref={ref}
      className="relative py-20 bg-background-subtle dark:bg-background-dark overflow-hidden"
    >
      {/* Decorations */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-px
                        bg-gradient-to-r from-transparent via-border-DEFAULT dark:via-border-dark to-transparent"
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-px
                        bg-gradient-to-r from-transparent via-border-DEFAULT dark:via-border-dark to-transparent"
        />
        <div
          className="absolute -bottom-40 right-0 w-[400px] h-[400px] rounded-full
                        bg-error-DEFAULT/[0.03] dark:bg-error-DEFAULT/[0.05] blur-3xl"
        />
        <div
          className="absolute -top-20 left-0 w-[300px] h-[300px] rounded-full
                        bg-kridha-primary/[0.04] blur-3xl"
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div>
            <motion.div
              variants={fadeUp}
              custom={0}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
            >
              <SectionLabel>Defence in Depth</SectionLabel>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              custom={1}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
              className="text-h2 font-bold text-[var(--color-text)] mb-3"
            >
              Security
              <br />
              <span className="text-kridha-primary">Highlights</span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              custom={2}
              animate={inView ? "visible" : "hidden"}
              initial="hidden"
              className="text-body-sm text-muted-DEFAULT dark:text-muted-dark max-w-md leading-relaxed"
            >
              Eight independent security controls. Each card shows what's
              protected and what attack it defeats.
            </motion.p>
          </div>

          {/* Category legend */}
          <motion.div
            variants={fadeUp}
            custom={2}
            animate={inView ? "visible" : "hidden"}
            initial="hidden"
            className="flex flex-wrap gap-1.5"
          >
            {(
              Object.entries(CATEGORY_COLORS) as [
                SecurityItem["category"],
                string,
              ][]
            ).map(([cat, cls]) => (
              <span
                key={cat}
                className={`px-2 py-0.5 rounded text-[9px] font-bold
                                            uppercase tracking-wider border ${cls}`}
              >
                {cat}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Cards grid */}
        <motion.div
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {SECURITY_ITEMS.map((item, i) => (
            <SecurityCard key={item.title} item={item} index={i} />
          ))}
        </motion.div>

        {/* Bottom note */}
        <motion.div
          variants={fadeUp}
          custom={12}
          animate={inView ? "visible" : "hidden"}
          initial="hidden"
          className="mt-10 flex items-start gap-3 p-4 rounded-2xl
                     border border-kridha-primary/20
                     bg-kridha-secondary/50 dark:bg-kridha-primary/[0.06]"
        >
          <ShieldCheck className="w-5 h-5 text-kridha-primary flex-shrink-0 mt-0.5" />
          <p className="text-label-sm text-[var(--color-text)] leading-relaxed">
            All security controls follow{" "}
            <span className="font-semibold">OWASP Top 10</span> mitigation
            patterns. Sensitive fields (PIN, OTP, bank account) are redacted
            from <span className="font-semibold">Pino structured logs</span> —
            credentials cannot appear in log storage. Error monitoring via{" "}
            <span className="font-semibold">GlitchTip</span> alerts on
            token-theft and credential-stuffing patterns in real time.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
