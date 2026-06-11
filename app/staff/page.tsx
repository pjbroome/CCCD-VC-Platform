"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { listVCRequests, updateVCRequest, photoUrl, createVCRequest } from "@/lib/api"
import type { VCRequestListItem } from "@/lib/api"
import { useTheme } from "@/components/vc/ThemeProvider"
import { ThemeSwitcher } from "@/components/vc/ThemeSwitcher"
import { themeStyleVars } from "@/lib/theme"

const STATUS_ORDER = ["new", "under_review", "deck_built", "recording_ready", "approved", "sent"]

const STATUS_FILTERS = [
  { value: "all", label: "All Requests" },
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "deck_built", label: "Deck Built" },
  { value: "recording_ready", label: "Recording Ready" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
] as const

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  pending: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  in_progress: "bg-amber-100 text-amber-700",
  deck_built: "bg-violet-100 text-violet-700",
  recording_ready: "bg-indigo-100 text-indigo-700",
  approved: "bg-emerald-100 text-emerald-700",
  sent: "bg-zinc-100 text-zinc-600",
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

function getDisplayName(req: VCRequestListItem): string {
  if (req.first_name && req.last_name) return `${req.first_name} ${req.last_name}`
  if (req.patient_name) return req.patient_name
  return "Unknown"
}

function initials(req: VCRequestListItem): string {
  const n = getDisplayName(req)
  return n.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"
}

export default function StaffDashboard() {
  const { theme } = useTheme()
  const [allRequests, setAllRequests] = useState<VCRequestListItem[]>([])
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", phone: "", concern: "" })
  const [addBusy, setAddBusy] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listVCRequests(undefined)
      setAllRequests(data.requests)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of allRequests) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [allRequests])

  const total = allRequests.length
  const filtered = useMemo(() => {
    let r = activeFilter === "all" ? allRequests : allRequests.filter((x) => x.status === activeFilter)
    const q = search.trim().toLowerCase()
    if (q) r = r.filter((x) => `${getDisplayName(x)} ${x.email ?? ""}`.toLowerCase().includes(q))
    return r
  }, [allRequests, activeFilter, search])

  async function addPatient() {
    if (!addForm.firstName.trim() || !addForm.email.trim()) {
      setAddErr("First name and email are required")
      return
    }
    setAddBusy(true)
    setAddErr(null)
    try {
      await createVCRequest({
        first_name: addForm.firstName.trim(),
        last_name: addForm.lastName.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        date_of_birth: null,
        city: null,
        state: null,
        concern: addForm.concern.trim() || "(added by staff)",
        consent_acknowledged: true,
        photos: [],
        referral_source: "Staff added",
      })
      setShowAdd(false)
      setAddForm({ firstName: "", lastName: "", email: "", phone: "", concern: "" })
      await fetchRequests()
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Could not add patient")
    } finally {
      setAddBusy(false)
    }
  }

  const kpis = [
    { label: "Total Requests", value: total, sub: "all time", icon: "inbox" },
    { label: "New", value: counts.new || 0, sub: "awaiting review", icon: "spark" },
    { label: "Recording Ready", value: counts.recording_ready || 0, sub: "ready to send", icon: "video" },
    { label: "Sent", value: counts.sent || 0, sub: "delivered", icon: "send" },
  ] as const

  return (
    <div className="flex min-h-dvh text-[var(--k-text)]" style={{ ...themeStyleVars(theme), background: "var(--k-bg)" }}>
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--k-line)] bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25A2.25 2.25 0 0 1 8.25 10.5H6A2.25 2.25 0 0 1 3.75 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-900">VC Portal</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">CCCD Staff</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {STATUS_FILTERS.map((f) => {
            const active = activeFilter === f.value
            const count = f.value === "all" ? total : counts[f.value] || 0
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition"
                style={active ? { background: "var(--k-accent-soft)", color: "var(--k-accent)" } : { color: "var(--k-muted)" }}
              >
                <span className="flex size-2 rounded-full" style={{ background: active ? "var(--k-accent)" : "rgba(20,18,40,0.18)" }} />
                <span className="flex-1 text-left">{f.label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={active ? { background: "var(--k-accent)", color: "var(--k-on-accent)" } : { background: "rgba(20,18,40,0.05)", color: "var(--k-muted)" }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-[var(--k-line)] p-3">
          <a href="/staff/feedback" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--k-muted)] transition hover:bg-zinc-50">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            Tester feedback
          </a>
          <a href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--k-muted)] transition hover:bg-zinc-50">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Patient intake site
          </a>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--k-line)] bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--k-accent)" }}>CCCD Staff Portal</p>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">Request Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={fetchRequests}
              className="hidden items-center gap-1.5 rounded-full border border-[var(--k-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--k-text)] shadow-sm transition hover:bg-zinc-50 sm:flex"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.985 14.652H-.007m4.008 0h4.984M19.5 12a7.5 7.5 0 1 1-2.197-5.303" />
              </svg>
              Refresh
            </button>
            <ThemeSwitcher />
            <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>
              PB
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)]">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{k.label}</p>
                  <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}>
                    <KpiIcon name={k.icon} />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">{k.value}</p>
                <p className="mt-1 text-xs text-zinc-400">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" /></svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full rounded-full border border-[var(--k-line)] bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-[var(--k-accent)] focus:ring-2 focus:ring-[var(--k-accent-soft)]"
              />
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
              style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Patient
            </button>
          </div>

          {/* Mobile filter chips */}
          <div className="mt-6 flex flex-wrap gap-2 lg:hidden">
            {STATUS_FILTERS.map((f) => {
              const active = activeFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
                  style={active ? { background: "var(--k-accent)", color: "var(--k-on-accent)" } : { background: "#fff", color: "var(--k-muted)", boxShadow: "inset 0 0 0 1px var(--k-line)" }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
              <button onClick={fetchRequests} className="ml-2 underline">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-zinc-400">
                <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading requests...</span>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center ring-1 ring-[var(--k-line)]">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-zinc-100">
                <svg className="size-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-600">No requests found</p>
              <p className="mt-1 text-xs text-zinc-400">
                {activeFilter !== "all" ? `No requests with status "${statusLabel(activeFilter)}"` : "No consultation requests have been submitted yet"}
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && filtered.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--k-line)]" style={{ background: "var(--k-bg)" }}>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">ID</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Patient</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Submitted</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Video</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Contact</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Photos</th>
                      <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--k-line)]">
                    {filtered.map((req) => (
                      <tr key={req.id} className="transition-colors hover:bg-zinc-50/70">
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">#{req.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {req.photos?.[0] ? (
                              <img src={photoUrl(req.photos[0])} alt="" className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-[var(--k-line)]" />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>
                                {initials(req)}
                              </span>
                            )}
                            <div>
                              <p className="font-medium text-zinc-900">{getDisplayName(req)}</p>
                              {(req.city || req.state) && (
                                <p className="text-xs text-zinc-400">{[req.city, req.state].filter(Boolean).join(", ")}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(req.created_at || req.submitted_at)}</td>
                        <td className="px-4 py-3">
                          <select
                            value={req.status}
                            onChange={async (e) => {
                              try {
                                await updateVCRequest(req.id, { status: e.target.value })
                                await fetchRequests()
                              } catch {
                                setError("Couldn't update status. Please retry.")
                                /* ignore */
                              }
                            }}
                            className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[req.status] || "bg-zinc-100 text-zinc-600"}`}
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {req.video_state === "seen" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <span className="size-1.5 rounded-full bg-emerald-500" /> Seen
                            </span>
                          ) : req.video_state === "sent" ? (
                            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700">Sent</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">Not sent</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-zinc-600">{req.email}</p>
                          <p className="text-[10px] text-zinc-400">{req.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {req.photos && req.photos.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                              </svg>
                              {req.photos.length}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-300">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/staff/${req.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:brightness-95"
                            style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}
                          >
                            View
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!addBusy) setShowAdd(false) }}>
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900">Add Patient</h3>
                  <button onClick={() => setShowAdd(false)} className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="mb-4 text-xs text-zinc-400">For phone or walk‑in inquiries. You&apos;re attesting the patient gave verbal consent.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} placeholder="First name *" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]" />
                    <input value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} placeholder="Last name" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]" />
                  </div>
                  <input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="Email *" type="email" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]" />
                  <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Phone" type="tel" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]" />
                  <textarea value={addForm.concern} onChange={(e) => setAddForm({ ...addForm, concern: e.target.value })} placeholder="What they want to change (optional)" rows={3} className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]" />
                  {addErr && <p className="text-xs font-medium text-red-600">{addErr}</p>}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setShowAdd(false)} className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100">Cancel</button>
                  <button onClick={addPatient} disabled={addBusy} className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>{addBusy ? "Adding…" : "Add Patient"}</button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-[10px] text-zinc-300">
            Charlotte Center for Cosmetic Dentistry · Staff Portal · {theme.name} theme
          </p>
        </main>
      </div>
    </div>
  )
}

function KpiIcon({ name }: { name: string }) {
  const cls = "size-5"
  if (name === "inbox")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
      </svg>
    )
  if (name === "spark")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    )
  if (name === "video")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    )
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}
