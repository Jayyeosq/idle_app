import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171F",
        "ink-soft": "#1D212C",
        brass: "#C89B3C",
        "brass-soft": "#E4C778",
        sage: "#7C9885",
        paper: "#EDE7DA",
        rust: "#B5533C",
        mist: "#9AA5B1",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
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
