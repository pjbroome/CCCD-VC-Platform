import Link from "next/link"
import { SAMPLE_THEMES } from "@/components/vc/sampleThemes"

export const metadata = {
  title: "VC Portal — Style Explorations",
}

export default function SamplesIndexPage() {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#0c0c0f,#16161b)] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">VC Portal · Patient page</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">5 glassmorphism explorations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Built from the Kleon template accent palette. Each is a different color story over frosted glass — open any one,
          then use the swatch row at the top to flip between them. Your current live patient page is untouched.
        </p>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_THEMES.map((t) => (
            <Link
              key={t.id}
              href={`/samples/${t.id}`}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/25"
            >
              <div className="relative h-36" style={{ background: t.swatch }}>
                <div className="absolute inset-0" style={t.page} />
                <div
                  className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: t.swatch, boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
                >
                  {t.id}
                </div>
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold">{t.name}</h2>
                <p className="mt-1 text-xs text-zinc-400">{t.vibe}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 group-hover:text-white">
                  Open variant {t.id} →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/consultation/1" className="rounded-full bg-white px-5 py-2.5 font-semibold text-zinc-900 transition hover:bg-zinc-200">
            View the live patient page (current)
          </Link>
          <Link href="/staff" className="rounded-full border border-white/20 px-5 py-2.5 font-semibold text-zinc-200 transition hover:bg-white/10">
            Staff dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
