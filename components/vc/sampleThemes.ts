import type { CSSProperties } from "react"

/**
 * 5 glassmorphism color explorations for the patient consult page,
 * built from the Kleon template accent tokens (globals.css --color-1..5):
 *   C1 coral  oklch(66.2% 0.225 25.9)
 *   C2 purple oklch(60.4% 0.26  302)
 *   C3 blue   oklch(69.6% 0.165 251)
 *   C4 cyan   oklch(80.2% 0.134 225)
 *   C5 lime   oklch(90.7% 0.231 133)
 * Colors are expressed in oklch so they match the template exactly.
 */

const BLUR = "blur(22px) saturate(150%)"

export function glass(dark: boolean, opacity?: number): CSSProperties {
  const o = opacity ?? (dark ? 0.08 : 0.5)
  return {
    background: `rgba(255,255,255,${o})`,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.65)",
    boxShadow: dark
      ? "0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)"
      : "0 24px 70px rgba(30,30,70,0.16), inset 0 1px 0 rgba(255,255,255,0.65)",
  }
}

export type PaletteSwatch = { hex: string; label: string }

export type SampleTheme = {
  id: number
  name: string
  vibe: string
  dark: boolean
  page: CSSProperties
  text: string
  muted: string
  accent: string
  button: CSSProperties
  buttonText: string
  poster: CSSProperties
  swatch: string
  palette: PaletteSwatch[]
}

const KLEON_PALETTE: PaletteSwatch[] = [
  { hex: "#E85C6B", label: "C1 Coral" },
  { hex: "#9D4EDD", label: "C2 Purple" },
  { hex: "#6488EC", label: "C3 Blue" },
  { hex: "#63C7EA", label: "C4 Cyan" },
  { hex: "#BEE847", label: "C5 Lime" },
]

export const SAMPLE_THEMES: SampleTheme[] = [
  {
    id: 1,
    name: "Aurora Glass",
    vibe: "All five Kleon accents · light frosted glass",
    dark: false,
    text: "#1a1626",
    muted: "#565064",
    accent: "oklch(56% 0.24 302)",
    buttonText: "#ffffff",
    button: { background: "linear-gradient(135deg, oklch(60.4% 0.26 302), oklch(69.6% 0.165 251))" },
    page: {
      background:
        "radial-gradient(42% 52% at 14% 18%, oklch(60.4% 0.26 302 / 0.45), transparent 70%)," +
        "radial-gradient(46% 56% at 86% 14%, oklch(69.6% 0.165 251 / 0.40), transparent 70%)," +
        "radial-gradient(50% 52% at 82% 84%, oklch(80.2% 0.134 225 / 0.42), transparent 70%)," +
        "radial-gradient(46% 48% at 12% 88%, oklch(66.2% 0.225 25.9 / 0.36), transparent 70%)," +
        "radial-gradient(40% 44% at 50% 50%, oklch(90.7% 0.231 133 / 0.18), transparent 70%)," +
        "linear-gradient(180deg,#fbfbfe,#f2f0f7)",
    },
    poster: {
      background:
        "linear-gradient(135deg, oklch(60.4% 0.26 302 / 0.92), oklch(69.6% 0.165 251 / 0.85) 55%, oklch(80.2% 0.134 225 / 0.82))",
    },
    swatch:
      "linear-gradient(135deg, oklch(66.2% 0.225 25.9), oklch(60.4% 0.26 302), oklch(69.6% 0.165 251), oklch(80.2% 0.134 225), oklch(90.7% 0.231 133))",
    palette: KLEON_PALETTE,
  },
  {
    id: 2,
    name: "Violet Dusk",
    vibe: "Purple → blue on near-black · dark luxe glass",
    dark: true,
    text: "#f4f2fb",
    muted: "#b8b3cf",
    accent: "oklch(80% 0.15 302)",
    buttonText: "#ffffff",
    button: { background: "linear-gradient(135deg, oklch(60.4% 0.26 302), oklch(66.2% 0.225 25.9))" },
    page: {
      background:
        "radial-gradient(52% 60% at 18% 8%, oklch(60.4% 0.26 302 / 0.55), transparent 64%)," +
        "radial-gradient(54% 60% at 88% 92%, oklch(69.6% 0.165 251 / 0.45), transparent 64%)," +
        "radial-gradient(40% 40% at 90% 10%, oklch(66.2% 0.225 25.9 / 0.22), transparent 70%)," +
        "linear-gradient(180deg,#0a0913,#13101f)",
    },
    poster: {
      background:
        "linear-gradient(135deg, oklch(60.4% 0.26 302 / 0.85), oklch(69.6% 0.165 251 / 0.78))",
    },
    swatch: "linear-gradient(135deg, oklch(60.4% 0.26 302), oklch(69.6% 0.165 251))",
    palette: KLEON_PALETTE,
  },
  {
    id: 3,
    name: "Coral Warmth",
    vibe: "Coral + soft lime · warm light glass",
    dark: false,
    text: "#2a1714",
    muted: "#6e524a",
    accent: "oklch(60% 0.22 25.9)",
    buttonText: "#ffffff",
    button: { background: "linear-gradient(135deg, oklch(63% 0.23 25.9), oklch(72% 0.17 45))" },
    page: {
      background:
        "radial-gradient(46% 56% at 12% 16%, oklch(66.2% 0.225 25.9 / 0.42), transparent 70%)," +
        "radial-gradient(48% 50% at 88% 12%, oklch(90.7% 0.231 133 / 0.22), transparent 72%)," +
        "radial-gradient(52% 56% at 86% 86%, oklch(66.2% 0.225 25.9 / 0.28), transparent 70%)," +
        "linear-gradient(180deg,#fff8f4,#fdece6)",
    },
    poster: {
      background:
        "linear-gradient(135deg, oklch(66.2% 0.225 25.9 / 0.92), oklch(80% 0.16 55 / 0.82))",
    },
    swatch: "linear-gradient(135deg, oklch(66.2% 0.225 25.9), oklch(82% 0.16 60))",
    palette: KLEON_PALETTE,
  },
  {
    id: 4,
    name: "Sky Mint",
    vibe: "Cyan + lime · fresh airy spa glass",
    dark: false,
    text: "#0f211e",
    muted: "#47625c",
    accent: "oklch(56% 0.11 215)",
    buttonText: "#0f211e",
    button: { background: "linear-gradient(135deg, oklch(80.2% 0.134 225), oklch(90.7% 0.231 133))" },
    page: {
      background:
        "radial-gradient(46% 56% at 15% 18%, oklch(80.2% 0.134 225 / 0.42), transparent 70%)," +
        "radial-gradient(48% 50% at 86% 16%, oklch(90.7% 0.231 133 / 0.28), transparent 72%)," +
        "radial-gradient(52% 56% at 82% 86%, oklch(80.2% 0.134 225 / 0.30), transparent 70%)," +
        "linear-gradient(180deg,#f3fbfb,#e9f6f2)",
    },
    poster: {
      background:
        "linear-gradient(135deg, oklch(80.2% 0.134 225 / 0.9), oklch(90.7% 0.231 133 / 0.72))",
    },
    swatch: "linear-gradient(135deg, oklch(80.2% 0.134 225), oklch(90.7% 0.231 133))",
    palette: KLEON_PALETTE,
  },
  {
    id: 5,
    name: "Mono Frost",
    vibe: "Graphite minimal · single blue accent",
    dark: true,
    text: "#ededf1",
    muted: "#a0a0aa",
    accent: "oklch(74% 0.15 251)",
    buttonText: "#ffffff",
    button: { background: "oklch(69.6% 0.165 251)" },
    page: {
      background:
        "radial-gradient(50% 50% at 80% 8%, oklch(69.6% 0.165 251 / 0.20), transparent 70%)," +
        "radial-gradient(40% 40% at 15% 90%, oklch(69.6% 0.165 251 / 0.10), transparent 70%)," +
        "linear-gradient(180deg,#0c0c0f,#151519)",
    },
    poster: {
      background:
        "linear-gradient(135deg, oklch(30% 0.03 251), oklch(22% 0.02 251))",
    },
    swatch: "linear-gradient(135deg, #2a2a31, oklch(69.6% 0.165 251))",
    palette: KLEON_PALETTE,
  },
]
