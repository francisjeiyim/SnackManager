import type { Config } from "tailwindcss";

/**
 * SnackManager — "warm hospitality" theme.
 *
 * One polished light theme: a sand/cream ground, terracotta accent, sage green
 * for positive state, a warm honey amber for "almost", a soft red for alerts,
 * and a muted teal for settled tickets. The neutral ramp (`stone`) is retuned
 * to a warm taupe so every existing `stone-*` / `emerald-*` / `amber-*` /
 * `rose-*` / `sky-*` class inherits the new palette without touching call sites.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Terracotta — primary accent.
        accent: {
          DEFAULT: "#e1663b",
          50: "#fdf4f0",
          100: "#fbe6dc",
          200: "#f5c9b4",
          300: "#eea687",
          400: "#e68159",
          500: "#e1663b",
          600: "#c9522b",
          700: "#a5401f",
          800: "#7f3218",
          900: "#5f2814",
        },
        // Warm taupe neutral — replaces Tailwind's cooler default `stone`.
        stone: {
          50: "#f6f1ea",
          100: "#efe7db",
          200: "#e5dacb",
          300: "#d5c6b1",
          400: "#a99e8d",
          500: "#7c7264",
          600: "#5c5346",
          700: "#453e33",
          800: "#332e26",
          900: "#22201b",
        },
        // Sage — positive / occupied / online (overrides `emerald`).
        emerald: {
          50: "#f1f5f1",
          100: "#dfe9e0",
          200: "#c0d3c2",
          300: "#9cb8a0",
          400: "#7ca080",
          500: "#6b8f71",
          600: "#54755a",
          700: "#435e48",
          800: "#374c3b",
          900: "#2e3f31",
        },
        // Honey — "almost" / near-boundary (overrides `amber`).
        amber: {
          50: "#fdf6ec",
          100: "#faeacf",
          200: "#f3d399",
          300: "#ebb962",
          400: "#e3a13d",
          500: "#d8892a",
          600: "#b96e20",
          700: "#95551c",
          800: "#78441c",
          900: "#623a1b",
        },
        // Soft red — alert / overdue / destructive (overrides `rose`).
        rose: {
          50: "#fdf3f3",
          100: "#fbe3e4",
          200: "#f5c4c6",
          300: "#ee9b9e",
          400: "#ea7074",
          500: "#e5484d",
          600: "#ce3439",
          700: "#ab282d",
          800: "#872227",
          900: "#6b2024",
        },
        // Muted teal — settled / informational (overrides `sky`).
        sky: {
          50: "#eff5f5",
          100: "#dbeaea",
          200: "#bad6d7",
          300: "#8fbbbd",
          400: "#5f9c9f",
          500: "#3f8184",
          600: "#316a6d",
          700: "#295659",
          800: "#244749",
          900: "#213d3f",
        },
        // Page ground.
        canvas: "#faf6f0",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Hiragino Kaku Gothic ProN",
          "Noto Sans JP",
          "Meiryo",
          "sans-serif",
        ],
      },
      borderRadius: {
        // Softer, friendlier corners across the board.
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.125rem",
        "2xl": "1.375rem",
        "3xl": "1.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(76 60 45 / 0.05), 0 6px 16px -8px rgb(76 60 45 / 0.12)",
        lift: "0 2px 6px rgb(76 60 45 / 0.08), 0 16px 32px -12px rgb(76 60 45 / 0.22)",
        panel: "0 12px 48px -12px rgb(45 35 25 / 0.32)",
        glow: "0 0 0 4px rgb(225 102 59 / 0.14)",
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(229 72 77 / 0.45)" },
          "50%": { boxShadow: "0 0 0 10px rgb(229 72 77 / 0)" },
        },
      },
      animation: {
        "sheet-up": "sheet-up 0.24s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.16s ease-out",
        pop: "pop 0.18s cubic-bezier(0.32, 0.72, 0, 1)",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
