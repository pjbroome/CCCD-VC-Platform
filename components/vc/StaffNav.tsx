"use client"

import Link from "next/link"
import { ThemeSwitcher } from "@/components/vc/ThemeSwitcher"

export type StaffStep = "dashboard" | "profile" | "deck" | "record"

const STEPS: { key: StaffStep; label: string; href: (id: number) => string }[] = [
  { key: "profile", label: "Profile", href: (id) => `/staff/${id}` },
  { key: "deck", label: "Build Deck", href: (id) => `/staff/${id}/deck` },
  { key: "record", label: "Record", href: (id) => `/staff/${id}/deck/present` },
]

function Chevron() {
  return (
    <svg className="size-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

/** Shared backend top bar: logo → dashboard, workflow stepper, theme switcher. */
export function StaffNav({
  current,
  requestId,
  patientName,
  actions,
}: {
  current: StaffStep
  requestId?: number
  patientName?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--k-line)] bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
      {/* left: logo + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/staff" className="flex shrink-0 items-center gap-2" title="Go to Dashboard">
          <span className="flex size-8 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25A2.25 2.25 0 0 1 8.25 10.5H6A2.25 2.25 0 0 1 3.75 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-zinc-900 sm:inline">VC Portal</span>
        </Link>

        {requestId ? (
          <div className="flex min-w-0 items-center gap-2">
            <Chevron />
            <Link href="/staff" className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--k-muted)] transition hover:bg-zinc-50">Dashboard</Link>
            {patientName && (
              <>
                <Chevron />
                <span className="hidden max-w-[160px] truncate text-xs font-semibold text-zinc-900 lg:inline" title={`${patientName} · #${requestId}`}>
                  {patientName} <span className="font-normal text-zinc-400">#{requestId}</span>
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Chevron />
            <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}>Dashboard</span>
          </div>
        )}
      </div>

      {/* center: workflow stepper */}
      {requestId && (
        <nav className="mx-auto hidden items-center gap-0.5 rounded-full bg-zinc-50 p-1 ring-1 ring-[var(--k-line)] md:flex">
          {STEPS.map((s, i) => {
            const active = s.key === current
            return (
              <span key={s.key} className="flex items-center">
                {i > 0 && <span className="px-0.5 text-zinc-300">·</span>}
                <Link
                  href={s.href(requestId)}
                  className="rounded-full px-3 py-1 text-xs font-semibold transition"
                  style={active ? { background: "var(--k-accent)", color: "var(--k-on-accent)" } : { color: "var(--k-muted)" }}
                >
                  {s.label}
                </Link>
              </span>
            )
          })}
        </nav>
      )}

      {/* right: actions + theme + avatar */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {actions}
        <ThemeSwitcher />
        <span className="hidden size-8 items-center justify-center rounded-full text-xs font-bold text-white sm:flex" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>PB</span>
      </div>
    </header>
  )
}
