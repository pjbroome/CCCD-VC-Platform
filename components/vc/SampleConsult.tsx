"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { AuroraText } from "@/components/ui/aurora-text"
import { BorderBeam } from "@/components/ui/border-beam"
import { SAMPLE_THEMES, hexToRgba, type SampleTheme } from "@/components/vc/sampleThemes"

const spring = { type: "spring" as const, stiffness: 100, damping: 20 }
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...spring, filter: { duration: 0.4 } } },
}

const TREATMENTS = [
  { treatment: "Smile Project (full smile makeover)", visits: "3 visits", investment: "$15,000 – $35,000" },
  { treatment: "Invisalign", visits: "3 – 4 visits", investment: "$4,500 – $9,500" },
]

export function SampleConsult({ theme }: { theme: SampleTheme }) {
  const accentSoft = hexToRgba(theme.accent, 0.09)
  const cardRing = "ring-1 ring-zinc-950/[0.04]"

  return (
    <main className="relative min-h-dvh overflow-hidden bg-zinc-50 text-zinc-900">
      {/* soft accent wash at the top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${hexToRgba(theme.accent, 0.1)}, transparent 70%)` }}
      />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10"
      >
        {/* ── Switcher / context bar ───────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className={`flex flex-col gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between ${cardRing}`}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
              Style Exploration {theme.id} / 5 · Kleon
            </p>
            <p className="mt-1 text-sm font-bold tracking-tight text-zinc-900">{theme.name}</p>
            <p className="text-xs text-zinc-400">{theme.vibe}</p>
          </div>
          <div className="flex items-center gap-2">
            {SAMPLE_THEMES.map((t) => {
              const active = t.id === theme.id
              return (
                <Link
                  key={t.id}
                  href={`/samples/${t.id}`}
                  title={t.name}
                  className="flex size-9 items-center justify-center rounded-full text-[11px] font-bold text-white transition hover:scale-105"
                  style={{
                    background: t.swatch,
                    outline: active ? `2px solid ${t.accent}` : "2px solid transparent",
                    outlineOffset: "2px",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
                    transform: active ? "scale(1.08)" : undefined,
                    textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                  }}
                >
                  {t.id}
                </Link>
              )
            })}
          </div>
        </motion.div>

        {/* ── Header ───────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span
              className="inline-block rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ background: accentSoft, color: theme.accent }}
            >
              Charlotte Center for Cosmetic Dentistry
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tighter sm:text-5xl">
              Patrick, your{" "}
              <AuroraText colors={theme.aurora} speed={1.5}>
                personalized video
              </AuroraText>
              <br />
              <span className="text-zinc-400">is ready</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-zinc-500 sm:text-base">
              Thank you for sharing your smile goals and photos. Below is your consultation video and the treatment ideas
              Dr. Broome captured for your case.
            </p>
          </div>
          <div className={`rounded-2xl bg-white px-4 py-3 text-xs shadow-sm ${cardRing}`}>
            <div className="text-zinc-400"><span className="font-semibold text-zinc-900">Consultation</span> #DS-1042</div>
            <div className="mt-1 text-zinc-400">Sent: Jun 5, 2026</div>
            <div className="mt-1 text-zinc-400">Status: <span className="font-semibold text-zinc-900">Sent</span></div>
          </div>
        </motion.div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
          {/* video + stats */}
          <motion.div variants={fadeUp} className="space-y-4">
            {/* double-bezel video frame */}
            <div className="rounded-[2rem] bg-zinc-950/[0.03] p-2 ring-1 ring-zinc-950/[0.04]">
              <div
                className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[calc(2rem-0.5rem)]"
                style={{ backgroundImage: `linear-gradient(135deg, ${theme.posterFrom}, ${theme.posterTo})` }}
              >
                <BorderBeam size={130} duration={7} colorFrom={theme.beamFrom} colorTo={theme.beamTo} borderWidth={2} />
                <BorderBeam size={130} duration={7} delay={3.5} reverse colorFrom={theme.beamFrom} colorTo={theme.beamTo} borderWidth={2} />

                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">Destination Smile</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Virtual Consultation</p>
                </div>

                {/* play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="flex size-[72px] items-center justify-center rounded-full text-white shadow-xl transition"
                    style={{ background: theme.accent, boxShadow: `0 10px 30px ${hexToRgba(theme.accent, 0.5)}` }}
                  >
                    <svg className="ml-1 size-8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </div>

                {/* mock control bar */}
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-md">
                  <svg className="size-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  <span className="text-[10px] font-medium tabular-nums text-white/90">0:00 / 0:17</span>
                  <div className="mx-1 h-1 flex-1 rounded-full bg-white/25">
                    <div className="h-1 w-1/4 rounded-full" style={{ background: theme.accent }} />
                  </div>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9v6h4l5 5V4L9 9H5z" /></svg>
                  <svg className="size-4 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9V4h5v2H6v3H4zm16 0h-2V6h-3V4h5v5zM4 15h2v3h3v2H4v-5zm16 0v5h-5v-2h3v-3h2z" /></svg>
                </div>
              </div>
            </div>

            {/* stat chips */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { k: "Sent", v: "Jun 5, 2026" },
                { k: "Views", v: "3" },
                { k: "Last watched", v: "2 min ago" },
              ].map((s) => (
                <div key={s.k} className={`rounded-2xl bg-white px-4 py-3 shadow-sm ${cardRing}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{s.k}</p>
                  <p className="mt-1.5 text-sm font-bold text-zinc-900">{s.v}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* summary aside */}
          <motion.aside variants={fadeUp}>
            <div className={`rounded-3xl bg-white p-5 shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] ${cardRing}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Treatment summary</p>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-zinc-900">Recommended next steps</h2>
              <div className="mt-4 space-y-3">
                {TREATMENTS.map((item) => (
                  <div key={item.treatment} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-950/[0.03]">
                    <p className="text-sm font-semibold text-zinc-900">{item.treatment}</p>
                    <p className="mt-1 text-xs text-zinc-500">Visits: {item.visits}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Investment: {item.investment}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed" style={{ background: accentSoft, color: "#52525b" }}>
                These ranges are estimates based on your photos — your in-office visit confirms the exact plan.
              </div>
              <button
                type="button"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-105"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.buttonFrom}, ${theme.buttonTo})`,
                  boxShadow: `0 6px 18px -4px ${hexToRgba(theme.accent, 0.5)}`,
                }}
              >
                Book my consultation
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              </button>
            </div>
          </motion.aside>
        </div>

        {/* ── Palette legend + live link ───────────────────────── */}
        <motion.div variants={fadeUp} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ${cardRing}`}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Kleon palette</span>
            {theme.palette.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5" title={p.label}>
                <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: p.hex }} />
                <span className="text-[11px] text-zinc-500">{p.label}</span>
              </span>
            ))}
          </div>
          <Link href="/consultation/1" className="text-xs font-medium underline-offset-4 hover:underline" style={{ color: theme.accent }}>
            Your live patient page (unchanged) →
          </Link>
        </motion.div>
      </motion.div>
    </main>
  )
}
