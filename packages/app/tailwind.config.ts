import type { Config } from "tailwindcss";

/**
 * SnackManager — "bright & cheerful" theme.
 *
 * Same shapes / motion as before, but a lively, high-saturation palette that
 * reads from across the room: a vivid tangerine accent, grass green for
 * positive state, marigold for "almost", a punchy red for alerts and a bright
 * blue for settled tickets, all on a crisp near-white ground. Retuned at the
 * Tailwind token level — the neutral ramp (`stone`) plus `emerald` / `amber` /
 * `rose` / `sky` are overridden — so every existing utility class inherits the
 * new colours without touching call sites.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tangerine — primary accent (bright, warm, cheerful).
        accent: {
          DEFAULT: "#ff6b2c",
          50: "#fff4ed",
          100: "#ffe3d0",
          200: "#ffc3a0",
          300: "#ff9d6b",
          400: "#ff7a41",
          500: "#ff6b2c",
          600: "#f5520e",
          700: "#c73f0b",
          800: "#9c3410",
          900: "#7e2e12",
        },
        // Clean light warm-grey neutral — lets the vivid colours sing
        // (replaces the previous heavy taupe `stone`).
        stone: {
          50: "#f8f8f5",
          100: "#f1f1ec",
          200: "#e4e3dc",
          300: "#d1d0c6",
          400: "#a7a69b",
          500: "#77766c",
          600: "#56554d",
          700: "#3e3d37",
          800: "#292824",
          900: "#1a1a17",
        },
        // Grass green — positive / occupied / online (overrides `emerald`).
        emerald: {
          50: "#ebfdf1",
          100: "#cff9de",
          200: "#a1f0c1",
          300: "#63e39d",
          400: "#2ece78",
          500: "#12b76a",
          600: "#039855",
          700: "#027a48",
          800: "#05603a",
          900: "#054f31",
        },
        // Marigold — "almost" / near-boundary (overrides `amber`).
        amber: {
          50: "#fffaeb",
          100: "#fef0c7",
          200: "#fedf89",
          300: "#fec84b",
          400: "#fdb022",
          500: "#f79009",
          600: "#dc6803",
          700: "#b54708",
          800: "#93370d",
          900: "#7a2e0e",
        },
        // Punchy red — alert / overdue / destructive (overrides `rose`).
        rose: {
          50: "#fef3f2",
          100: "#fee4e2",
          200: "#fecdca",
          300: "#fda29b",
          400: "#f97066",
          500: "#f04438",
          600: "#d92d20",
          700: "#b42318",
          800: "#912018",
          900: "#7a271a",
        },
        // Bright blue — settled / informational (overrides `sky`).
        sky: {
          50: "#eff8ff",
          100: "#d1e9ff",
          200: "#b2ddff",
          300: "#84caff",
          400: "#53b1fd",
          500: "#2e90fa",
          600: "#1570ef",
          700: "#175cd3",
          800: "#1849a9",
          900: "#194185",
        },
        // Page ground.
        canvas: "#f7f7f3",
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
        card: "0 1px 2px rgb(40 38 32 / 0.05), 0 6px 16px -8px rgb(40 38 32 / 0.12)",
        lift: "0 2px 6px rgb(40 38 32 / 0.08), 0 16px 32px -12px rgb(40 38 32 / 0.20)",
        panel: "0 12px 48px -12px rgb(26 26 23 / 0.30)",
        glow: "0 0 0 4px rgb(255 107 44 / 0.18)",
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(240 68 56 / 0.5)" },
          "50%": { boxShadow: "0 0 0 12px rgb(240 68 56 / 0)" },
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
