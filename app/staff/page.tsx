"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { listVCRequests, updateVCRequest } from "@/lib/api"
import type { VCRequestListItem } from "@/lib/api"

const STATUS_ORDER = ["new", "under_review", "deck_built", "recording_ready", "approved", "sent"]

const STATUS_FILTERS = [
  { value: "all", label: "All" },
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
  deck_built: "bg-purple-100 text-purple-700",
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
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

function getDisplayName(req: VCRequestListItem): string {
  if (req.first_name && req.last_name) return `${req.first_name} ${req.last_name}`
  if (req.patient_name) return req.patient_name
  return "Unknown"
}

function getSubmittedDate(req: VCRequestListItem): string {
  return formatDate(req.created_at || req.submitted_at)
}

export default function StaffDashboard() {
  const [requests, setRequests] = useState<VCRequestListItem[]>([])
  const [total, setTotal] = useState(0)
  const [activeFilter, setActiveFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async (status: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listVCRequests(status === "all" ? undefined : status)
      setRequests(data.requests)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests(activeFilter)
  }, [activeFilter, fetchRequests])

  const handleFilterChange = (value: string) => {
    setActiveFilter(value)
  }

  const filteredRequests = activeFilter === "all"
    ? requests
    : requests.filter((r) => r.status === activeFilter)

  return (
    <div className="min-h-dvh bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">
              CCCD Staff Portal
            </p>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
              VC Request Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              {total} request{total !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => fetchRequests(activeFilter)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Status Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeFilter === f.value
                  ? "bg-[#c4a052] text-white shadow-sm"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
            <button onClick={() => fetchRequests(activeFilter)} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
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

        {/* Empty State */}
        {!loading && !error && filteredRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-zinc-100">
              <svg className="size-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-600">No requests found</p>
            <p className="mt-1 text-xs text-zinc-400">
              {activeFilter !== "all"
                ? `No requests with status "${statusLabel(activeFilter)}"`
                : "No consultation requests have been submitted yet"}
            </p>
          </div>
        )}

        {/* Request Table */}
        {!loading && !error && filteredRequests.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/[0.04]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Patient Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Submitted</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Contact</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Photos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="transition-colors hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-xs font-mono text-zinc-400">#{req.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{getDisplayName(req)}</p>
                        {(req.city || req.state) && (
                          <p className="text-xs text-zinc-400">
                            {[req.city, req.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{getSubmittedDate(req)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={req.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value
                            try {
                              await updateVCRequest(req.id, { status: newStatus })
                              fetchRequests(activeFilter)
                            } catch { /* ignore */ }
                          }}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer ${STATUS_COLORS[req.status] || "bg-zinc-100 text-zinc-600"}`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{statusLabel(s)}</option>
                          ))}
                        </select>
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
                          className="inline-flex items-center gap-1 rounded-lg bg-[#c4a052]/10 px-3 py-1.5 text-xs font-medium text-[#c4a052] transition-colors hover:bg-[#c4a052]/20"
                        >
                          View Profile
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
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-zinc-100 py-4 text-center text-[10px] text-zinc-300">
        Charlotte Center for Cosmetic Dentistry &middot; Staff Portal &middot; VC Request Management
      </footer>
    </div>
  )
}
