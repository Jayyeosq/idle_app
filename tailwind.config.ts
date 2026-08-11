import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAFA",
        card: "#FFFFFF",
        ink: "#171717",
        "ink-soft": "#5C5C5C",
        line: "#E8E8E8",
        mist: "#777777",
        sage: "#4F6553",
        "sage-tint": "#EEF3EF",
        rust: "#B23A2E",
        brass: "#171717",
        "brass-soft": "#333333",
      },
      fontFamily: {
        display: ["var(--font-dm-serif)", "serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
        mono: ["var(--font-dm-sans)", "sans-serif"],
      },
      keyframes: {
        "dial-idle": {
          "0%, 100%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(8deg)" },
        },
        "dial-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "dial-idle": "dial-idle 4s ease-in-out infinite",
        "dial-spin": "dial-spin 1.1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
