/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */

module.exports = {
  darkMode: "class",

  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    // ─── Base overrides (replaces defaults) ────────────────────────────
    fontFamily: {
      sans: ["Inter", "Noto Sans Devanagari", "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ["Fira Code", "ui-monospace", "monospace"],
    },

    fontSize: {
      // Display — hero, landing
      "display-2xl": ["3.75rem", { lineHeight: "1.1",  letterSpacing: "-0.02em", fontWeight: "700" }],
      "display-xl":  ["3rem",    { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
      "display-lg":  ["2.25rem", { lineHeight: "1.2",  letterSpacing: "-0.01em", fontWeight: "700" }],
      "display-md":  ["1.875rem",{ lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
      "display-sm":  ["1.5rem",  { lineHeight: "1.3",  letterSpacing: "0",       fontWeight: "700" }],

      // Heading — sections
      "h1": ["2rem",    { lineHeight: "1.3", fontWeight: "700" }],
      "h2": ["1.75rem", { lineHeight: "1.3", fontWeight: "700" }],
      "h3": ["1.5rem",  { lineHeight: "1.4", fontWeight: "600" }],
      "h4": ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
      "h5": ["1.125rem",{ lineHeight: "1.5", fontWeight: "600" }],
      "h6": ["1rem",    { lineHeight: "1.5", fontWeight: "600" }],

      // Body — content
      "body-lg":  ["1.125rem", { lineHeight: "1.6", fontWeight: "400" }],
      "body-md":  ["1rem",     { lineHeight: "1.6", fontWeight: "400" }],
      "body-sm":  ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
      "body-xs":  ["0.75rem",  { lineHeight: "1.5", fontWeight: "400" }],

      // Label — forms, UI elements
      "label-lg": ["1rem",     { lineHeight: "1.4", fontWeight: "500" }],
      "label-md": ["0.875rem", { lineHeight: "1.4", fontWeight: "500" }],
      "label-sm": ["0.75rem",  { lineHeight: "1.4", fontWeight: "500" }],

      // Code
      "code-md": ["0.875rem", { lineHeight: "1.6", fontWeight: "400" }],
      "code-sm": ["0.75rem",  { lineHeight: "1.5", fontWeight: "400" }],
    },

    // ─── Spacing scale ───────────────────────────────────────────────────
    spacing: {
      px:    "1px",
      0:     "0",
      0.5:   "0.125rem",
      1:     "0.25rem",
      1.5:   "0.375rem",
      2:     "0.5rem",
      2.5:   "0.625rem",
      3:     "0.75rem",
      3.5:   "0.875rem",
      4:     "1rem",
      5:     "1.25rem",
      6:     "1.5rem",
      7:     "1.75rem",
      8:     "2rem",
      9:     "2.25rem",
      10:    "2.5rem",
      11:    "2.75rem",
      12:    "3rem",
      14:    "3.5rem",
      16:    "4rem",
      18:    "4.5rem",
      20:    "5rem",
      24:    "6rem",
      28:    "7rem",
      32:    "8rem",
      36:    "9rem",
      40:    "10rem",
      44:    "11rem",
      48:    "12rem",
      56:    "14rem",
      64:    "16rem",
      72:    "18rem",
      80:    "20rem",
      96:    "24rem",

      // Semantic aliases
      "page-x":   "1rem",
      "page-x-md":"1.5rem",
      "page-x-lg":"2rem",
      "section-y":"4rem",
      "card":     "1.25rem",
    },

    // ─── Border radius ───────────────────────────────────────────────────
    borderRadius: {
      none: "0",
      sm:   "0.25rem",
      md:   "0.5rem",
      lg:   "0.75rem",
      xl:   "1rem",
      "2xl":"1.25rem",
      "3xl":"1.5rem",
      full: "9999px",

      // Semantic
      btn:  "0.75rem",
      card: "1rem",
      pill: "9999px",
      modal:"1.25rem",
    },

    extend: {
      // ─── Brand + UI color system ────────────────────────────────────
      colors: {
        // Primary brand
        kridha: {
          primary:   "#2A9D8F",
          "primary-hover":  "#228A7C",
          "primary-active": "#1A7A6E",
          "primary-light":  "#E6F5F3",
          "primary-ghost":  "#F0FAF9",

          secondary: "#E9F5F3",

          accent:    "#E9C24A",
          "accent-hover":  "#D4AE3E",
          "accent-active": "#BF9A34",
          "accent-light":  "#FDF8E5",
          "accent-ghost":  "#FEFBF0",
        },

        // Semantic states
        success: {
          DEFAULT: "#22C55E",
          light:   "#F0FDF4",
          dark:    "#15803D",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light:   "#FFFBEB",
          dark:    "#B45309",
        },
        error: {
          DEFAULT: "#EF4444",
          light:   "#FEF2F2",
          dark:    "#B91C1C",
        },
        info: {
          DEFAULT: "#3B82F6",
          light:   "#EFF6FF",
          dark:    "#1D4ED8",
        },

        // Order status
        status: {
          pending:    "#F59E0B",
          confirmed:  "#3B82F6",
          awaiting:   "#F97316",
          otp:        "#8B5CF6",
          completed:  "#22C55E",
          cancelled:  "#EF4444",
          disputed:   "#6B7280",
        },

        // Surface system
        surface: {
          DEFAULT: "#FFFFFF",
          dark:    "#1F2937",
          elevated:"#FFFFFF",
          "elevated-dark": "#374151",
        },

        // Background system
        background: {
          DEFAULT: "#F9FAFB",
          dark:    "#111827",
          subtle:  "#F3F4F6",
          "subtle-dark": "#1F2937",
        },

        // Text system
        text: {
          DEFAULT:  "#111827",
          dark:     "#F9FAFB",
          secondary:"#374151",
          "secondary-dark":"#D1D5DB",
        },

        // Muted — labels, captions
        muted: {
          DEFAULT: "#6B7280",
          dark:    "#9CA3AF",
        },

        // Border system
        border: {
          DEFAULT: "#E5E7EB",
          dark:    "#374151",
          strong:  "#D1D5DB",
          "strong-dark": "#4B5563",
          focus:   "#2A9D8F",
        },

        // Complete gray ramp for utility classes
        gray: {
          50:  "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
          950: "#030712",
        },
      },

      // ─── Box shadows ─────────────────────────────────────────────────
      boxShadow: {
        // Elevation levels
        "xs":   "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "sm":   "0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)",
        "md":   "0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)",
        "lg":   "0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)",
        "xl":   "0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)",
        "2xl":  "0 25px 50px -12px rgb(0 0 0 / 0.25)",

        // Semantic
        "card":   "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.12)",
        "modal":  "0 20px 60px -10px rgb(0 0 0 / 0.3)",
        "btn":    "0 1px 2px 0 rgb(0 0 0 / 0.08)",
        "btn-primary": "0 4px 12px 0 rgb(42 157 143 / 0.3)",

        // Focus rings
        "focus-primary": "0 0 0 3px rgb(42 157 143 / 0.3)",
        "focus-error":   "0 0 0 3px rgb(239 68 68 / 0.3)",

        // Dark mode
        "dark-sm":  "0 1px 3px 0 rgb(0 0 0 / 0.3)",
        "dark-md":  "0 4px 6px -1px rgb(0 0 0 / 0.4)",
        "dark-card":"0 1px 3px 0 rgb(0 0 0 / 0.4)",

        none: "none",
      },

      // ─── Transitions ─────────────────────────────────────────────────
      transitionDuration: {
        fast:    "100ms",
        normal:  "200ms",
        slow:    "300ms",
        slower:  "500ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        ease:   "cubic-bezier(0.4, 0, 1, 1)",
      },

      // ─── Keyframes ───────────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        "slide-in-up": {
          from: { transform: "translateY(100%)" },
          to:   { transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        countdown: {
          from: { strokeDashoffset: "0" },
          to:   { strokeDashoffset: "100" },
        },
      },
      animation: {
        "fade-in":       "fade-in 200ms ease-out",
        "fade-up":       "fade-up 200ms ease-out",
        "slide-in-right":"slide-in-right 300ms cubic-bezier(0.4,0,0.2,1)",
        "slide-in-up":   "slide-in-up 300ms cubic-bezier(0.4,0,0.2,1)",
        "scale-in":      "scale-in 150ms cubic-bezier(0.4,0,0.2,1)",
        shimmer:         "shimmer 1.5s infinite linear",
        "pulse-slow":    "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        spin:            "spin 1s linear infinite",
        countdown:       "countdown 30s linear forwards",
      },

      // ─── Breakpoints ─────────────────────────────────────────────────
      screens: {
        xs:  "375px",   // small phones
        sm:  "640px",
        md:  "768px",
        lg:  "1024px",
        xl:  "1280px",
        "2xl":"1440px",
      },

      // ─── Z-index scale ───────────────────────────────────────────────
      zIndex: {
        hide:    "-1",
        base:    "0",
        raised:  "10",
        dropdown:"20",
        sticky:  "30",
        overlay: "40",
        modal:   "50",
        toast:   "60",
        tooltip: "70",
      },

      // ─── Max widths ───────────────────────────────────────────────────
      maxWidth: {
        "page":     "1280px",
        "page-md":  "1024px",
        "page-sm":  "768px",
        "content":  "680px",
        "form":     "480px",
        "card":     "380px",
      },

      // ─── Min heights ──────────────────────────────────────────────────
      minHeight: {
        screen:  "100dvh",
        "50vh":  "50dvh",
        touch:   "44px",
      },

      // ─── Aspect ratios ────────────────────────────────────────────────
      aspectRatio: {
        "product": "4/3",
        "hero":    "16/9",
        "avatar":  "1/1",
        "card":    "3/2",
      },

      // ─── Background image ─────────────────────────────────────────────
      backgroundImage: {
        shimmer: "linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.6) 50%, transparent 100%)",
        "shimmer-dark": "linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.1) 50%, transparent 100%)",
        "kridha-gradient": "linear-gradient(135deg, #2A9D8F 0%, #1A7A6E 100%)",
        "kridha-soft": "linear-gradient(135deg, #E9F5F3 0%, #F0FAF9 100%)",
        "hero-pattern": "radial-gradient(ellipse at top, #E9F5F3 0%, #F9FAFB 60%)",
      },

      // ─── Blur ─────────────────────────────────────────────────────────
      blur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
      },

      // ─── Typography plugin config ─────────────────────────────────────
      typography: (theme) => ({
        kridha: {
          css: {
            "--tw-prose-body":        theme("colors.text.DEFAULT"),
            "--tw-prose-headings":    theme("colors.text.DEFAULT"),
            "--tw-prose-links":       theme("colors.kridha.primary"),
            "--tw-prose-bold":        theme("colors.text.DEFAULT"),
            "--tw-prose-counters":    theme("colors.muted.DEFAULT"),
            "--tw-prose-bullets":     theme("colors.kridha.primary"),
            "--tw-prose-hr":          theme("colors.border.DEFAULT"),
            "--tw-prose-code":        theme("colors.kridha.primary"),
            "--tw-prose-pre-bg":      theme("colors.gray.900"),
          },
        },
      }),
    },
  },

  plugins: [],
};
