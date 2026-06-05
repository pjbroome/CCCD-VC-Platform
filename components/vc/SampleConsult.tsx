"use client"

import Link from "next/link"
import { glass, SAMPLE_THEMES, type SampleTheme } from "@/components/vc/sampleThemes"

const TREATMENTS = [
  { treatment: "Smile Project (full smile makeover)", visits: "3 visits", investment: "$15,000 – $35,000" },
  { treatment: "Invisalign", visits: "3 – 4 visits", investment: "$4,500 – $9,500" },
]

export function SampleConsult({ theme }: { theme: SampleTheme }) {
  const { dark } = theme
  const panel = glass(dark)
  const softCard = glass(dark, dark ? 0.06 : 0.42)
  const chip = glass(dark, dark ? 0.05 : 0.38)

  return (
    <main style={theme.page} className="min-h-dvh w-full">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {/* ── Switcher / context bar ───────────────────────────── */}
        <div
          style={panel}
          className="flex flex-col gap-4 rounded-3xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
              Style Exploration {theme.id} / 5 · Kleon palette
            </p>
            <p className="mt-1 text-base font-bold" style={{ color: theme.text }}>
              {theme.name}
            </p>
            <p className="text-xs" style={{ color: theme.muted }}>
              {theme.vibe}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {SAMPLE_THEMES.map((t) => {
              const active = t.id === theme.id
              return (
                <Link
                  key={t.id}
                  href={`/samples/${t.id}`}
                  title={t.name}
                  className="flex size-9 items-center justify-center rounded-full text-[11px] font-bold transition"
                  style={{
                    background: t.swatch,
                    color: "#fff",
                    outline: active ? `2px solid ${theme.text}` : "2px solid transparent",
                    outlineOffset: "2px",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                    transform: active ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  <span style={{ mixBlendMode: "normal", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{t.id}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── The consult card ─────────────────────────────────── */}
        <section style={panel} className="mt-6 overflow-hidden rounded-[34px]">
          {/* header band */}
          <div className="flex flex-col gap-5 px-6 py-8 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Destination Smile Virtual Consultation
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: theme.text }}>
                Patrick, your personalized video is ready
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: theme.muted }}>
                Thank you for sharing your smile goals and photos. Below is your consultation video and the treatment
                ideas captured for your case.
              </p>
            </div>
            <div style={chip} className="rounded-2xl px-4 py-3 text-xs" >
              <div style={{ color: theme.muted }}>
                <span className="font-semibold" style={{ color: theme.text }}>Consultation</span> #DS-1042
              </div>
              <div className="mt-1" style={{ color: theme.muted }}>Sent: Jun 5, 2026</div>
              <div className="mt-1" style={{ color: theme.muted }}>
                Status: <span className="font-semibold" style={{ color: theme.text }}>Sent</span>
              </div>
            </div>
          </div>

          {/* body */}
          <div className="grid gap-7 px-6 pb-9 sm:px-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
            {/* video + stats */}
            <div className="space-y-4">
              {/* video poster mock */}
              <div
                style={theme.poster}
                className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl"
              >
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/85">Destination Smile</p>
                  <p className="mt-1 text-2xl font-bold text-white drop-shadow sm:text-3xl">Virtual Consultation</p>
                </div>
                {/* center play */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="flex size-[72px] items-center justify-center rounded-full"
                    style={{ ...glass(false, 0.35), boxShadow: "0 12px 36px rgba(0,0,0,0.35)" }}
                  >
                    <svg className="ml-1 size-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                {/* mock control bar */}
                <div
                  className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-full px-4 py-2"
                  style={glass(true, 0.18)}
                >
                  <svg className="size-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  <span className="text-[10px] font-medium tabular-nums text-white/90">0:00 / 0:17</span>
                  <div className="mx-1 h-1 flex-1 rounded-full bg-white/30">
                    <div className="h-1 w-1/4 rounded-full" style={{ background: theme.accent }} />
                  </div>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9v6h4l5 5V4L9 9H5z" /></svg>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9V4h5v2H6v3H4zm16 0h-2V6h-3V4h5v5zM4 15h2v3h3v2H4v-5zm16 0v5h-5v-2h3v-3h2z" /></svg>
                </div>
              </div>

              {/* stat chips */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Sent", v: "Jun 5, 2026" },
                  { k: "Views", v: "3" },
                  { k: "Last watched", v: "2 min ago" },
                ].map((s) => (
                  <div key={s.k} style={softCard} className="rounded-2xl px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}>{s.k}</p>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: theme.text }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* summary aside */}
            <aside className="space-y-4">
              <div style={softCard} className="rounded-3xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Treatment summary</p>
                <h2 className="mt-2 text-lg font-bold" style={{ color: theme.text }}>Recommended next steps</h2>
                <div className="mt-4 space-y-3">
                  {TREATMENTS.map((item) => (
                    <div key={item.treatment} style={chip} className="rounded-2xl p-4">
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>{item.treatment}</p>
                      <p className="mt-1 text-xs" style={{ color: theme.muted }}>Visits: {item.visits}</p>
                      <p className="mt-0.5 text-xs" style={{ color: theme.muted }}>Investment: {item.investment}</p>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed"
                  style={{ ...chip, color: theme.muted }}
                >
                  These ranges are estimates based on your photos — your in-office visit confirms the exact plan.
                </div>
                <button
                  type="button"
                  className="mt-5 w-full rounded-full px-5 py-3 text-sm font-bold shadow-lg transition hover:brightness-110"
                  style={{ ...theme.button, color: theme.buttonText }}
                >
                  Book my consultation
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ── Palette legend + live link ───────────────────────── */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div style={chip} className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}>Kleon palette</span>
            {theme.palette.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5" title={p.label}>
                <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: p.hex }} />
                <span className="text-[11px]" style={{ color: theme.muted }}>{p.label}</span>
              </span>
            ))}
          </div>
          <Link
            href="/consultation/1"
            className="text-xs font-medium underline-offset-4 hover:underline"
            style={{ color: theme.accent }}
          >
            Your live patient page (unchanged) →
          </Link>
        </div>
      </div>
    </main>
  )
}
