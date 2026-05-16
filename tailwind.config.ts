import type { Config } from "tailwindcss"
import typography from "@tailwindcss/typography"

export default {
  content: ["./src/**/*.{html,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        // Surface hierarchy
        surface: "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "on-surface": "#191c1e",
        "on-surface-variant": "#4c4546",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",
        outline: "#7e7576",
        "outline-variant": "#cfc4c5",
        "surface-tint": "#5e5e5e",

        // Primary — black monochrome
        primary: "#000000",
        "on-primary": "#ffffff",
        "primary-container": "#1b1b1b",
        "on-primary-container": "#848484",
        "inverse-primary": "#c6c6c6",
        "primary-fixed": "#e2e2e2",
        "primary-fixed-dim": "#c6c6c6",
        "on-primary-fixed": "#1b1b1b",
        "on-primary-fixed-variant": "#474747",

        // Secondary — blue
        secondary: "#0051d5",
        "on-secondary": "#ffffff",
        "secondary-container": "#316bf3",
        "on-secondary-container": "#fefcff",
        "secondary-fixed": "#dbe1ff",
        "secondary-fixed-dim": "#b4c5ff",
        "on-secondary-fixed": "#00174b",
        "on-secondary-fixed-variant": "#003ea8",

        // Tertiary — orange
        tertiary: "#000000",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#370e00",
        "on-tertiary-container": "#e45405",
        "tertiary-fixed": "#ffdbce",
        "tertiary-fixed-dim": "#ffb599",
        "on-tertiary-fixed": "#370e00",
        "on-tertiary-fixed-variant": "#7f2b00",

        // Error
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        // Background
        background: "#f7f9fb",
        "on-background": "#191c1e",

        // Team identity
        "team-a": "#0051d5",
        "team-b": "#e45405",

        // Team 3 — green
        "team-3": "#2e7d32",
        "team-3-fixed": "#e8f5e9",
        "on-team-3-fixed": "#1b5e20",

        // Team 4 — purple
        "team-4": "#6a1b9a",
        "team-4-fixed": "#f3e5f5",
        "on-team-4-fixed": "#4a148c",

        // Team 5 — teal
        "team-5": "#00695c",
        "team-5-fixed": "#e0f2f1",
        "on-team-5-fixed": "#004d40",

        // Success — green (for Guessed action)
        success: "#22c55e",
        "on-success": "#ffffff",

        // Player colors — 6 distinct high-saturation
        "player-1": "#d32f2f",
        "player-2": "#388e3c",
        "player-3": "#fbc02d",
        "player-4": "#7b1fa2",
        "player-5": "#0288d1",
        "player-6": "#e64a19",
      },
      fontFamily: {
        display: ["Epilogue", "sans-serif"],
        body: ["Be Vietnam Pro", "sans-serif"],
      },
      fontSize: {
        display: ["48px", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "800" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "800" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        xs: "4px",
        sm: "12px",
        md: "24px",
        lg: "40px",
        xl: "64px",
        gutter: "16px",
        "container-padding": "24px",
      },
    },
  },
  plugins: [typography],
} satisfies Config
