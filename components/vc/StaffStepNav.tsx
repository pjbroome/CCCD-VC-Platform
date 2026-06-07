"use client"

import Link from "next/link"

type Step = "profile" | "deck" | "record"

const ORDER: { key: Step; label: string; href: (id: number) => string }[] = [
  { key: "profile", label: "Patient Profile", href: (id) => `/staff/${id}` },
  { key: "deck", label: "Build Deck", href: (id) => `/staff/${id}/deck` },
  { key: "record", label: "Record", href: (id) => `/staff/${id}/deck/present` },
]

/** Shared bottom workflow bar: Back · step jumps · Next →. */
export function StaffStepNav({ current, requestId }: { current: Step; requestId: number }) {
  const idx = ORDER.findIndex((o) => o.key === current)
  const prev = idx > 0 ? { label: ORDER[idx - 1].label, href: ORDER[idx - 1].href(requestId) } : { label: "Dashboard", href: "/staff" }
  const next =
    idx < ORDER.length - 1
      ? { label: ORDER[idx + 1].label, href: ORDER[idx + 1].href(requestId) }
      : { label: "Back to Profile", href: `/staff/${requestId}` }

  return (
    <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--k-line)] bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
      <Link href={prev.href} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--k-muted)] transition hover:bg-zinc-100">
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        {prev.label}
      </Link>

      <div className="hidden items-center gap-1 sm:flex">
        {ORDER.map((o) => (
          <Link
            key={o.key}
            href={o.href(requestId)}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition"
            style={o.key === current ? { background: "var(--k-accent-soft)", color: "var(--k-accent)" } : { color: "var(--k-muted)" }}
          >
            {o.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-zinc-200" />
        <Link href="/staff" className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[var(--k-muted)] transition hover:bg-zinc-100">Dashboard</Link>
      </div>

      <Link href={next.href} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700">
        {next.label}
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
      </Link>
    </div>
  )
}
