"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { listFeedback, type FeedbackItem } from "@/lib/api"

function avg(nums: (number | undefined)[]): string {
  const v = nums.filter((n): n is number => typeof n === "number")
  if (!v.length) return "—"
  return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)
}

function fmtDate(s?: string): string {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  } catch {
    return s
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  )
}

export default function StaffFeedbackPage() {
  const [rows, setRows] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listFeedback()
      .then((d) => setRows(d.feedback || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const nps = rows.map((r) => r.nps).filter((n): n is number => typeof n === "number")
    const promoters = nps.filter((n) => n >= 9).length
    const detractors = nps.filter((n) => n <= 6).length
    const npsScore = nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : null
    const comfy = rows.filter((r) => (r.comfortable || "").toLowerCase() === "yes").length
    return {
      count: rows.length,
      ease: avg(rows.map((r) => r.ease)),
      photo: avg(rows.map((r) => r.photo_ease)),
      clarity: avg(rows.map((r) => r.clarity)),
      trust: avg(rows.map((r) => r.trust)),
      npsScore,
      comfyPct: rows.length ? Math.round((comfy / rows.length) * 100) : 0,
    }
  }, [rows])

  return (
    <main className="min-h-dvh bg-[var(--k-bg)] px-4 py-8 text-[var(--k-text)] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">CCCD Staff Portal</p>
            <h1 className="text-2xl font-bold text-zinc-900">Tester Feedback</h1>
          </div>
          <Link href="/staff" className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}>← Dashboard</Link>
        </div>

        {loading && <p className="text-sm text-zinc-400">Loading…</p>}
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Responses" value={String(stats.count)} />
              <Stat label="Ease" value={stats.ease} sub="of 5" />
              <Stat label="Photo upload" value={stats.photo} sub="of 5" />
              <Stat label="Clarity" value={stats.clarity} sub="of 5" />
              <Stat label="Trust/look" value={stats.trust} sub="of 5" />
              <Stat label="NPS" value={stats.npsScore === null ? "—" : String(stats.npsScore)} sub={`${stats.comfyPct}% comfy`} />
            </div>

            {rows.length === 0 ? (
              <p className="mt-8 text-center text-sm text-zinc-400">No feedback yet. Share the survey link with testers.</p>
            ) : (
              <div className="mt-6 space-y-3">
                {[...rows].reverse().map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}>{r.role || "Tester"}</span>
                      <span className="text-zinc-400">{r.device || "—"}</span>
                      <span className="text-zinc-300">·</span>
                      <span className="text-zinc-400">{fmtDate(r.created_at)}</span>
                      {(r.name || r.email) && <span className="ml-auto text-zinc-500">{[r.name, r.email].filter(Boolean).join(" · ")}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span>Ease <b>{r.ease ?? "—"}</b></span>
                      <span>Photos <b>{r.photo_ease ?? "—"}</b></span>
                      <span>Clarity <b>{r.clarity ?? "—"}</b></span>
                      <span>Trust <b>{r.trust ?? "—"}</b></span>
                      <span>NPS <b>{r.nps ?? "—"}</b></span>
                      <span>Comfortable: <b>{r.comfortable ?? "—"}</b></span>
                    </div>
                    {(r.liked || r.confusing || r.suggestions) && (
                      <div className="mt-3 space-y-1.5 text-sm text-zinc-700">
                        {r.liked && <p><span className="text-emerald-600">+ Liked:</span> {r.liked}</p>}
                        {r.confusing && <p><span className="text-amber-600">⚠ Confusing:</span> {r.confusing}</p>}
                        {r.suggestions && <p><span className="text-sky-600">→ Suggests:</span> {r.suggestions}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
