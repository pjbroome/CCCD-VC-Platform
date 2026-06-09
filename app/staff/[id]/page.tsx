"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  getVCRequest,
  updateVCRequest,
  photoUrl,
  uploadVideo,
  createConsultation,
  getConsultation,
  videoUrl,
  approveConsultation,
  sendConsultation,
  resendConsultation,
} from "@/lib/api"
import type { VCRequestListItem, Consultation } from "@/lib/api"
import { StaffNav } from "@/components/vc/StaffNav"
import { StaffStepNav } from "@/components/vc/StaffStepNav"
import { PhotoEditor } from "@/components/vc/PhotoEditor"

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

const STATUS_ORDER = [
  "new",
  "under_review",
  "deck_built",
  "recording_ready",
  "approved",
  "sent",
]

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function getDisplayName(req: VCRequestListItem): string {
  if (req.first_name && req.last_name) return `${req.first_name} ${req.last_name}`
  if (req.patient_name) return req.patient_name
  return "Unknown"
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RequestDetail() {
  const params = useParams()
  const id = Number(params.id)
  const [request, setRequest] = useState<VCRequestListItem | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* video upload state */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)

  /* status change state */
  const [changingStatus, setChangingStatus] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  /* review & send state */
  const [reviewAction, setReviewAction] = useState(false)
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id || isNaN(id)) {
      setError("Invalid request ID")
      setLoading(false)
      return
    }
    async function load() {
      try {
        const data = await getVCRequest(id)
        setRequest(data)
        if (data.consultation_id) {
          try {
            const c = await getConsultation(data.consultation_id)
            setConsultation(c)
          } catch { /* consultation may not exist yet */ }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load request")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !request) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const videoResp = await uploadVideo(file)
      const consult = await createConsultation({
        request_id: request.id,
        patient_name: getDisplayName(request),
        video_url: videoResp.url,
        video_source: "doctor",
      })
      const updated = await updateVCRequest(request.id, {
        consultation_id: consult.id,
        status: "recording_ready",
      })
      setRequest(updated)
      setConsultation(consult)
      setUploadMsg(`Video uploaded (${formatBytes(videoResp.size_bytes)}) — Consultation #${consult.id}, status → Recording Ready`)
    } catch (err) {
      setUploadMsg(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [request])

  const handleDeleteVideo = useCallback(async () => {
    if (!request || !consultation) return
    if (typeof window !== "undefined" && !window.confirm("Delete this recording and start over? The patient link stops working until you record again.")) return
    try {
      const updated = await updateVCRequest(request.id, { consultation_id: null, status: "deck_built" })
      setRequest(updated)
      setConsultation(null)
      setUploadMsg("Recording removed — record a new one from the deck builder.")
    } catch (err) {
      setUploadMsg(`Delete failed: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }, [request, consultation])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!request || newStatus === request.status) return
    setChangingStatus(true)
    setStatusMsg(null)
    try {
      const updated = await updateVCRequest(request.id, { status: newStatus })
      setRequest(updated)
      setStatusMsg(`Status → ${statusLabel(newStatus)}`)
      setTimeout(() => setStatusMsg(null), 3000)
    } catch (err) {
      setStatusMsg(`Failed: ${err instanceof Error ? err.message : "unknown"}`)
    } finally {
      setChangingStatus(false)
    }
  }, [request])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--k-bg)]">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading request...</span>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--k-bg)] px-4">
        <div className="text-center">
          <p className="text-sm font-medium text-red-600">{error || "Request not found"}</p>
          <Link href="/staff" className="mt-4 inline-block text-sm text-[var(--k-accent)] underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const concern = request.concern || request.message || ""

  return (
    <div className="min-h-dvh bg-[var(--k-bg)]">
      <StaffNav
        current="profile"
        requestId={request.id}
        patientName={getDisplayName(request)}
        actions={
          <span
            className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
              STATUS_COLORS[request.status] || "bg-zinc-100 text-zinc-600"
            }`}
          >
            {statusLabel(request.status)}
          </span>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6">
        {/* Patient Info Card */}
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h2 className="mb-4 text-base font-bold text-zinc-900 sm:text-lg">
            {getDisplayName(request)}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="Email" value={request.email} />
            <InfoRow label="Phone" value={request.phone} />
            <InfoRow label="Date of Birth" value={request.date_of_birth || "—"} />
            <InfoRow
              label="Location"
              value={
                [request.city, request.state].filter(Boolean).join(", ") || "—"
              }
            />
            <InfoRow label="Submitted" value={formatDate(request.created_at || request.submitted_at)} />
            <InfoRow label="Last Updated" value={formatDate(request.updated_at)} />
            <InfoRow label="Referral Source" value={request.referral_source || "—"} />
            <InfoRow label="Source URL" value={request.source_url || "—"} />
          </div>
        </div>

        {/* Concern / Message */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Patient Concern</h3>
          <p className="text-sm leading-relaxed text-zinc-600">
            {concern || "No concern provided"}
          </p>
        </div>

        {/* Photos */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">
            Patient Photos ({request.photos?.length || 0})
          </h3>
          {request.photos && request.photos.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {request.photos.map((photo, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                  <button
                    type="button"
                    onClick={() => setEditingPhoto(i)}
                    className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100"
                    title="Rotate / edit photo"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    Edit
                  </button>
                  <img
                    src={photoUrl(photo)}
                    alt={`Patient photo ${i + 1}`}
                    className="h-48 w-full object-cover sm:h-64"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                      const fallback = target.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = "flex"
                    }}
                  />
                  <div className="hidden h-48 items-center justify-center text-xs text-zinc-400 sm:h-64">
                    Photo unavailable
                  </div>
                  <div className="border-t border-zinc-200 px-3 py-2">
                    <p className="truncate text-[10px] text-zinc-400">{photo}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No photos uploaded</p>
          )}
          {editingPhoto !== null && request.photos?.[editingPhoto] && (
            <PhotoEditor
              photoPath={request.photos[editingPhoto]}
              label={`Photo ${editingPhoto + 1}`}
              onClose={() => setEditingPhoto(null)}
              onSaved={async (newPath) => {
                const idx = editingPhoto
                const newPhotos = [...(request.photos || [])]
                newPhotos[idx] = newPath
                // Let failures propagate to the editor (it keeps the modal open + shows an error)
                const updated = await updateVCRequest(request.id, { photos: newPhotos })
                setRequest(updated)
                setEditingPhoto(null)
              }}
            />
          )}
        </div>

        {/* Step 1 — build the presentation (always the first action) */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">Presentation</h3>
          <p className="mb-3 text-xs text-zinc-500">{request.deck_id ? "Deck built — edit it or open the recorder." : "Step 1: build this patient's slide deck from the library, then record the walkthrough."}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/staff/${request.id}/deck`} className="inline-flex items-center gap-2 rounded-lg bg-[var(--k-accent)] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--k-accent-strong)]">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>
              {request.deck_id ? "Edit Deck" : "Build Deck"}
            </Link>
            {request.deck_id && (
              <Link href={`/staff/${request.id}/deck/present`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                Present &amp; Record
              </Link>
            )}
          </div>
        </div>

        {/* Video / Consultation — only after a deck is built */}
        {request.deck_id && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Consultation Video</h3>
          {consultation && consultation.video_url ? (
            <div>
              <video src={videoUrl(consultation.video_url)} controls className="w-full rounded-lg bg-black" style={{ maxHeight: 400 }} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-400">
                <span>Consultation #{consultation.id}</span>
                <span>Source: {consultation.video_source}</span>
                <span>Created: {formatDate(consultation.created_at)}</span>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--k-bg)] px-3 py-3 ring-1 ring-zinc-200">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Patient receipt link</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/consultation/${consultation.token ?? consultation.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-zinc-700"
                  >
                    Open patient video page
                  </Link>
                  <span className="truncate text-[10px] text-zinc-500">/consultation/{consultation.token ?? consultation.id}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[var(--k-bg)] px-3 py-2 ring-1 ring-zinc-200">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400">Opened</p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-900">{consultation.watch_count ?? 0}&times;</p>
                </div>
                <div className="rounded-lg bg-[var(--k-bg)] px-3 py-2 ring-1 ring-zinc-200">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400">Played</p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-900">{consultation.play_count ?? 0}&times;</p>
                </div>
                <div className="rounded-lg bg-[var(--k-bg)] px-3 py-2 ring-1 ring-zinc-200">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400">Last activity</p>
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-700">{formatDate(consultation.last_played_at || consultation.last_watched_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-zinc-100">
                <svg className="size-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <p className="text-xs text-zinc-500">No video attached yet</p>
            </div>
          )}
          <div className="mt-4">
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--k-accent)] px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[var(--k-accent-strong)] disabled:opacity-40">
              {uploading ? (
                <><svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading...</>
              ) : (
                <><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>{consultation ? "Replace Video" : "Upload Video"}</>
              )}
            </button>
            {consultation && consultation.video_url && (
              <button onClick={handleDeleteVideo} disabled={uploading} className="ml-2 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9M5.78 5.79l.84 13.88A2.25 2.25 0 0 0 8.86 21.75h6.28a2.25 2.25 0 0 0 2.24-2.08L18.22 5.79M9 5.79V3.75A1.5 1.5 0 0 1 10.5 2.25h3A1.5 1.5 0 0 1 15 3.75v2.04" /></svg>
                Delete &amp; re-record
              </button>
            )}
          </div>
          {uploadMsg && <p className={`mt-2 text-xs font-medium ${uploadMsg.startsWith("Upload failed") || uploadMsg.startsWith("Delete failed") ? "text-red-600" : "text-emerald-600"}`}>{uploadMsg}</p>}
        </div>
        )}

        {/* Review & Send */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Review &amp; Send</h3>
          {(() => {
            const hasVideo = !!(consultation && consultation.video_url)
            const hasDeck = !!request.deck_id
            const isApproved = request.status === "approved" || request.status === "sent"
            const isSent = request.status === "sent"
            const isRecordingReady = request.status === "recording_ready"

            if (!hasVideo && !hasDeck) {
              return (
                <div className="rounded-lg bg-[var(--k-bg)] px-4 py-6 text-center">
                  <p className="text-xs font-medium text-zinc-500">Not ready for review</p>
                  <p className="mt-1 text-[10px] text-zinc-400">Build a deck and upload a video before approving.</p>
                  <div className="mt-3 flex justify-center gap-4 text-[10px] text-zinc-400">
                    <span className={hasDeck ? "text-emerald-600" : ""}>{hasDeck ? "\u2713" : "\u2717"} Deck</span>
                    <span className={hasVideo ? "text-emerald-600" : ""}>{hasVideo ? "\u2713" : "\u2717"} Video</span>
                  </div>
                </div>
              )
            }

            return (
              <div>
                {/* Readiness checklist */}
                <div className="mb-4 flex flex-wrap gap-4 text-xs">
                  <span className={`inline-flex items-center gap-1 ${hasDeck ? "text-emerald-600" : "text-zinc-400"}`}>
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {hasDeck ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />}
                    </svg>
                    Deck #{request.deck_id || "—"}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${hasVideo ? "text-emerald-600" : "text-zinc-400"}`}>
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {hasVideo ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />}
                    </svg>
                    Video attached
                  </span>
                  <span className={`inline-flex items-center gap-1 ${isApproved ? "text-emerald-600" : "text-zinc-400"}`}>
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {isApproved ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />}
                    </svg>
                    Approved
                  </span>
                  <span className={`inline-flex items-center gap-1 ${isSent ? "text-emerald-600" : "text-zinc-400"}`}>
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {isSent ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />}
                    </svg>
                    Sent to patient
                  </span>
                </div>

                {/* Sent confirmation */}
                {isSent && consultation?.sent_at && (
                  <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
                    <p className="text-xs font-medium text-emerald-700">Consultation sent to patient</p>
                    <p className="mt-0.5 text-[10px] text-emerald-600">Sent: {formatDate(consultation.sent_at)}{consultation.watch_count ? ` · Viewed ${consultation.watch_count} time${consultation.watch_count !== 1 ? "s" : ""}` : ""}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Approve button — visible when recording_ready but not yet approved */}
                  {(isRecordingReady || request.status === "deck_built") && hasVideo && (
                    <button
                      disabled={reviewAction}
                      onClick={async () => {
                        if (!consultation) return
                        setReviewAction(true)
                        setReviewMsg(null)
                        try {
                          await approveConsultation(consultation.id)
                          const updated = await updateVCRequest(request.id, { status: "approved" })
                          setRequest(updated)
                          const c = await getConsultation(consultation.id)
                          setConsultation(c)
                          setReviewMsg("Consultation approved — ready to send")
                        } catch (err) {
                          setReviewMsg(`Approve failed: ${err instanceof Error ? err.message : "unknown"}`)
                        } finally {
                          setReviewAction(false)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--k-accent)] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--k-accent-strong)] disabled:opacity-40"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      Approve Consultation
                    </button>
                  )}

                  {/* Send button — visible when approved but not yet sent */}
                  {request.status === "approved" && consultation && (
                    <button
                      disabled={reviewAction}
                      onClick={async () => {
                        setReviewAction(true)
                        setReviewMsg(null)
                        try {
                          const { consultation: c, request: r, emailed } = await sendConsultation(consultation.id, request.id)
                          setRequest(r)
                          setConsultation(c)
                          setReviewMsg(
                            emailed
                              ? `Sent — patient emailed their video link (${request.email}).`
                              : `Marked sent, but email is not configured yet — copy the patient's link: /consultation/${c.token ?? c.id}`
                          )
                        } catch (err) {
                          setReviewMsg(`Send failed: ${err instanceof Error ? err.message : "unknown"}`)
                        } finally {
                          setReviewAction(false)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--k-accent)] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--k-accent-strong)] disabled:opacity-40"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                      Send to Patient
                    </button>
                  )}

                  {/* Resend button — visible when already sent */}
                  {isSent && consultation && (
                    <button
                      disabled={reviewAction}
                      onClick={async () => {
                        setReviewAction(true)
                        setReviewMsg(null)
                        try {
                          const c = await resendConsultation(consultation.id)
                          setConsultation(c)
                          setReviewMsg("Follow-up resent to patient")
                        } catch (err) {
                          setReviewMsg(`Resend failed: ${err instanceof Error ? err.message : "unknown"}`)
                        } finally {
                          setReviewAction(false)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-[var(--k-bg)] disabled:opacity-40"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                      Resend Follow-up
                    </button>
                  )}
                </div>
                {reviewMsg && <p className={`mt-2 text-xs font-medium ${reviewMsg.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>{reviewMsg}</p>}
              </div>
            )
          })()}
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">Staff Notes</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{request.notes}</p>
          </div>
        )}

        {/* Workflow Status */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Workflow Status</h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => handleStatusChange(s)} disabled={changingStatus || s === request.status} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${s === request.status ? `${STATUS_COLORS[s] || "bg-zinc-100 text-zinc-600"} ring-2 ring-offset-1 ring-zinc-300` : "bg-[var(--k-bg)] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"} disabled:cursor-default`}>
                {statusLabel(s)}
              </button>
            ))}
          </div>
          {statusMsg && <p className={`mt-2 text-xs font-medium ${statusMsg.startsWith("Failed") ? "text-red-600" : "text-emerald-600"}`}>{statusMsg}</p>}
        </div>

        {/* Metadata */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_2px_20px_-8px_rgba(20,18,40,0.12)] ring-1 ring-[var(--k-line)] sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Request Metadata</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoRow label="Request ID" value={`#${request.id}`} />
            <InfoRow label="Status" value={statusLabel(request.status)} />
            <InfoRow label="Consent" value={request.consent_acknowledged ? "Acknowledged" : "—"} />
            <InfoRow label="Deck ID" value={request.deck_id ? `#${request.deck_id}` : "Not assigned"} />
            <InfoRow label="Consultation ID" value={request.consultation_id ? `#${request.consultation_id}` : "Not assigned"} />
            <InfoRow label="Photos Count" value={String(request.photos?.length || 0)} />
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-zinc-300">
          Charlotte Center for Cosmetic Dentistry · Staff Portal
        </p>
      </div>

      <StaffStepNav current="profile" requestId={request.id} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-700">{value}</p>
    </div>
  )
}
