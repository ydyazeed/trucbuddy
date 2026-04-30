import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          coral: "#E5574E",
          teal: "#2A7268",
          mint: "#C8DCD4",
        },
        canvas: "#F8FAFC",
        ink: {
          DEFAULT: "#0F172A",
          subtle: "#475569",
          faint: "#94A3B8",
        },
      },
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
        sheet: "0 -2px 10px rgba(15,23,42,0.06), 0 -10px 32px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
