import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: {
          bg: "#0a0a0f",
          surface: "#12121a",
          card: "#1a1a26",
          border: "#2a2a3d",
          accent: "#f97316",
          "accent-dim": "#c2410c",
          live: "#22c55e",
          muted: "#6b7280",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
