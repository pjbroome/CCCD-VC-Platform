/**
 * Swappable accent themes for the staff (backend) admin UI.
 * Neutrals stay constant (light canvas + white cards); only the accent
 * family changes per theme so the backend can be recolored "for fun" anytime.
 * Default = purple accent (#7E38D5).
 */

export type ThemeId = "purple" | "gold" | "sapphire" | "emerald" | "rose" | "slate"

export type Theme = {
  id: ThemeId
  name: string
  accent: string
  accentStrong: string
  accentSoft: string // rgba tint for soft backgrounds
  gradFrom: string
  gradTo: string
  onAccent: string
  swatch: string // css gradient used for the picker chip
}

export const THEMES: Theme[] = [
  { id: "purple", name: "Purple", accent: "#7E38D5", accentStrong: "#6C2BD9", accentSoft: "rgba(126,56,213,0.10)", gradFrom: "#8743DF", gradTo: "#B06BE8", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#8743DF,#B06BE8)" },
  { id: "gold", name: "CCCD Gold", accent: "#b8933f", accentStrong: "#a07f31", accentSoft: "rgba(196,160,82,0.14)", gradFrom: "#c4a052", gradTo: "#e8c972", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#c4a052,#e8c972)" },
  { id: "sapphire", name: "Sapphire", accent: "#2f6df0", accentStrong: "#1d5fe0", accentSoft: "rgba(47,109,240,0.10)", gradFrom: "#4f7df0", gradTo: "#63C7EA", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#4f7df0,#63C7EA)" },
  { id: "emerald", name: "Emerald", accent: "#0f9b6c", accentStrong: "#0b7d57", accentSoft: "rgba(16,155,108,0.10)", gradFrom: "#14b88a", gradTo: "#34d399", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#14b88a,#34d399)" },
  { id: "rose", name: "Rose", accent: "#e0457b", accentStrong: "#c8366a", accentSoft: "rgba(224,69,123,0.10)", gradFrom: "#EC4899", gradTo: "#F472B6", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#EC4899,#F472B6)" },
  { id: "slate", name: "Slate", accent: "#475569", accentStrong: "#334155", accentSoft: "rgba(71,85,105,0.10)", gradFrom: "#64748b", gradTo: "#94a3b8", onAccent: "#ffffff", swatch: "linear-gradient(135deg,#64748b,#94a3b8)" },
]

export const DEFAULT_THEME_ID: ThemeId = "gold"  // opens on-brand (CCCD Gold); admin can switch + it persists
export const THEME_STORAGE_KEY = "vc-staff-theme"

export const THEME_MAP: Record<ThemeId, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<ThemeId, Theme>

/** Constant neutral canvas (light look) — same across all themes. */
export const NEUTRAL_VARS: Record<string, string> = {
  "--k-bg": "#f5f4f9",
  "--k-card": "#ffffff",
  "--k-text": "#1c1b22",
  "--k-muted": "#6b6a7b",
  "--k-line": "rgba(20,18,40,0.08)",
}

/** Accent CSS variables for a given theme. */
export function accentVars(t: Theme): Record<string, string> {
  return {
    "--k-accent": t.accent,
    "--k-accent-strong": t.accentStrong,
    "--k-accent-soft": t.accentSoft,
    "--k-grad-from": t.gradFrom,
    "--k-grad-to": t.gradTo,
    "--k-on-accent": t.onAccent,
  }
}

/** All CSS variables (neutrals + accent) as one object for an inline style. */
export function themeStyleVars(t: Theme): React.CSSProperties {
  return { ...NEUTRAL_VARS, ...accentVars(t) } as React.CSSProperties
}
