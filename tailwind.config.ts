import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: {
          bg: "#10100f",
          surface: "#181917",
          card: "#20211f",
          border: "#343731",
          accent: "#2dd4bf",
          "accent-dim": "#0f766e",
          amber: "#f5b84b",
          red: "#ef5b5b",
          live: "#22c55e",
          muted: "#9a9f92",
        },
      },
      borderRadius: {
        xl: "0.5rem",
        "2xl": "0.5rem",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
