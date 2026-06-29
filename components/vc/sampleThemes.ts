/**
 * 5 color explorations of the patient consult page:
 * light editorial layout, white double-bezel cards, AuroraText headlines,
 * BorderBeam glow on the video, gold/accent gradient pill buttons, motion.
 * Only the COLOR changes between variants — the structure stays.
 *
 * Accent hexes are tuned for contrast on white; aurora/beam arrays use the
 * Accent family (globals.css --color-1..5) where relevant.
 */

export type PaletteSwatch = { hex: string; label: string }

export type SampleTheme = {
  id: number
  name: string
  vibe: string
  accent: string // primary accent (hex), readable on white
  aurora: string[] // AuroraText gradient colors
  buttonFrom: string
  buttonTo: string
  beamFrom: string
  beamTo: string
  posterFrom: string // dark video-thumbnail gradient
  posterTo: string
  swatch: string // css gradient for the switcher chip
  palette: PaletteSwatch[]
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const BASE_PALETTE: PaletteSwatch[] = [
  { hex: "#E85C6B", label: "C1 Coral" },
  { hex: "#9D4EDD", label: "C2 Purple" },
  { hex: "#6488EC", label: "C3 Blue" },
  { hex: "#63C7EA", label: "C4 Cyan" },
  { hex: "#BEE847", label: "C5 Lime" },
]

export const SAMPLE_THEMES: SampleTheme[] = [
  {
    id: 1,
    name: "Signature Gold",
    vibe: "The brand default · warm gold aurora",
    accent: "#c4a052",
    aurora: ["#c4a052", "#d4b062", "#e8c972", "#c4a052"],
    buttonFrom: "#c4a052",
    buttonTo: "#d4b062",
    beamFrom: "#e8c972",
    beamTo: "#c4a052",
    posterFrom: "#2a2414",
    posterTo: "#0c0c10",
    swatch: "linear-gradient(135deg,#c4a052,#e8c972)",
    palette: BASE_PALETTE,
  },
  {
    id: 2,
    name: "Aurora",
    vibe: "Full rainbow headline · violet accent",
    accent: "#8a5cf0",
    aurora: ["#E85C6B", "#9D4EDD", "#6488EC", "#63C7EA", "#BEE847"],
    buttonFrom: "#9D4EDD",
    buttonTo: "#6488EC",
    beamFrom: "#E85C6B",
    beamTo: "#63C7EA",
    posterFrom: "#1a1430",
    posterTo: "#0b0b14",
    swatch: "linear-gradient(135deg,#E85C6B,#9D4EDD,#6488EC,#63C7EA,#BEE847)",
    palette: BASE_PALETTE,
  },
  {
    id: 3,
    name: "Sapphire",
    vibe: "Cool blue → cyan · crisp and modern",
    accent: "#4f7df0",
    aurora: ["#6488EC", "#63C7EA", "#8AA6F2", "#6488EC"],
    buttonFrom: "#4f7df0",
    buttonTo: "#63C7EA",
    beamFrom: "#63C7EA",
    beamTo: "#6488EC",
    posterFrom: "#0f1a33",
    posterTo: "#0a0d18",
    swatch: "linear-gradient(135deg,#6488EC,#63C7EA)",
    palette: BASE_PALETTE,
  },
  {
    id: 4,
    name: "Orchid",
    vibe: "Purple → coral · bold and elegant",
    accent: "#b24bd0",
    aurora: ["#9D4EDD", "#B36BE8", "#E85C6B", "#9D4EDD"],
    buttonFrom: "#9D4EDD",
    buttonTo: "#E85C6B",
    beamFrom: "#B36BE8",
    beamTo: "#E85C6B",
    posterFrom: "#20143a",
    posterTo: "#0c0a16",
    swatch: "linear-gradient(135deg,#9D4EDD,#E85C6B)",
    palette: BASE_PALETTE,
  },
  {
    id: 5,
    name: "Verdant",
    vibe: "Emerald → lime · fresh, spa-clean",
    accent: "#149e6b",
    aurora: ["#34d399", "#63C7EA", "#BEE847", "#34d399"],
    buttonFrom: "#14b88a",
    buttonTo: "#34d399",
    beamFrom: "#BEE847",
    beamTo: "#34d399",
    posterFrom: "#0c2620",
    posterTo: "#0a1512",
    swatch: "linear-gradient(135deg,#14b88a,#BEE847)",
    palette: BASE_PALETTE,
  },
]
