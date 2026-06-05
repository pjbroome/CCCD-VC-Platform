import Link from "next/link"
import { SAMPLE_THEMES, hexToRgba } from "@/components/vc/sampleThemes"

export const metadata = {
  title: "VC Portal — Style Explorations",
}

export default function SamplesIndexPage() {
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c4a052]">VC Portal · Patient page</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">5 color explorations — Kleon style</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Same Kleon look as the rest of the site — light layout, aurora gradient headline, glowing border-beam on the
          video, gold/accent gradient buttons — with a different color story each. Open any one, then use the swatch row
          at the top to flip between them. Your current live patient page is untouched.
        </p>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_THEMES.map((t) => (
            <Link
              key={t.id}
              href={`/samples/${t.id}`}
              className="group overflow-hidden rounded-3xl bg-white shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] ring-1 ring-zinc-950/[0.04] transition hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.12)]"
            >
              <div className="relative h-32" style={{ background: t.swatch }}>
                <div
                  className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: t.swatch, boxShadow: "0 3px 10px rgba(0,0,0,0.25)", textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
                >
                  {t.id}
                </div>
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold tracking-tight">{t.name}</h2>
                <p className="mt-1 text-xs text-zinc-400">{t.vibe}</p>
                <span
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: t.accent }}
                >
                  Open variant {t.id} →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link
            href="/consultation/1"
            className="rounded-full px-5 py-2.5 font-semibold text-white"
            style={{ backgroundImage: "linear-gradient(to right,#c4a052,#d4b062)", boxShadow: `0 6px 18px -4px ${hexToRgba("#c4a052", 0.5)}` }}
          >
            View the live patient page (current)
          </Link>
          <Link href="/staff" className="rounded-full bg-white px-5 py-2.5 font-semibold text-zinc-700 ring-1 ring-zinc-950/10 transition hover:bg-zinc-100">
            Staff dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
