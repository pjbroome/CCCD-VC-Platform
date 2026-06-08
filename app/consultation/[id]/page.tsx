"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { getConsultationByToken, recordConsultationWatchByToken, recordConsultationPlayByToken, videoUrl } from "@/lib/api"
import type { Consultation } from "@/lib/api"
import { VideoPlayer } from "@/components/vc/VideoPlayer"

type ReceiptState = "idle" | "recording" | "done" | "failed"

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function ConsultationReceiptPage() {
  const params = useParams()
  // The [id] route segment now carries an unguessable share token, not a numeric ID.
  const token = String(params.id || "")

  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [watchState, setWatchState] = useState<ReceiptState>("idle")
  const [watchMsg, setWatchMsg] = useState<string | null>(null)
  const hasOpened = useRef(false)
  const hasPlayed = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getConsultationByToken(token)
        if ((data as unknown as { error?: string }).error) {
          throw new Error((data as unknown as { error?: string }).error)
        }
        setConsultation(data)
        if (!hasOpened.current) {
          hasOpened.current = true
          try {
            const opened = await recordConsultationWatchByToken(token)
            setConsultation(opened)
          } catch {
            /* ignore open-tracking errors */
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load consultation")
      } finally {
        setLoading(false)
      }
    }

    if (!token) {
      setError("Invalid consultation link")
      setLoading(false)
      return
    }

    load()
  }, [token])

  const recommendationItems = useMemo(() => {
    return consultation?.summary_slide_data?.items ?? []
  }, [consultation])

  async function trackPlay() {
    if (!consultation || hasPlayed.current) return
    hasPlayed.current = true
    try {
      const r = await recordConsultationPlayByToken(token)
      setConsultation((prev) => (prev ? { ...prev, play_count: r.play_count, last_played_at: r.last_played_at } : prev))
    } catch {
      hasPlayed.current = false
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f6f3] px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <svg className="size-5 animate-spin text-[#c4a052]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-zinc-600">Loading your consultation...</span>
        </div>
      </div>
    )
  }

  if (error || !consultation) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f6f3] px-4">
        <div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 16.5h.008v.008H12V16.5Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">Consultation unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">{error || "We could not find that consultation video."}</p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700">
            Return to Virtual Consultation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-dvh bg-[#f7f6f3] text-zinc-900">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-zinc-100 bg-[radial-gradient(circle_at_top_left,_rgba(196,160,82,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf8f3_100%)] px-6 py-8 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c4a052]">Destination Smile Virtual Consultation</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  {consultation.patient_name ? `${consultation.patient_name}, your personalized video is ready` : "Your personalized video is ready"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                  Thank you for submitting your smile goals and photos. Below is your consultation video along with the treatment ideas captured for your case so your family or team can review them with you.
                </p>
              </div>
              <div className="rounded-2xl border border-[#c4a052]/20 bg-white/80 px-4 py-3 text-xs text-zinc-500 shadow-sm backdrop-blur">
                <div><span className="font-semibold text-zinc-900">Consultation</span> #{consultation.id}</div>
                <div className="mt-1">Sent: {formatDate(consultation.sent_at || consultation.created_at)}</div>
                <div className="mt-1">Status: <span className="font-medium capitalize text-zinc-800">{consultation.status.replace(/_/g, " ")}</span></div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)] lg:px-10 lg:py-8">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-zinc-200 shadow-lg">
                {consultation.video_url ? (
                  <VideoPlayer src={videoUrl(consultation.video_url)} onFirstPlay={trackPlay} />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-zinc-950 text-sm text-zinc-400">
                    Your consultation video is being prepared.
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Video source</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 capitalize">{consultation.video_source}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Views tracked</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">{consultation.watch_count ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Last watched</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">{formatDate(consultation.last_watched_at)}</p>
                </div>
              </div>

              {watchMsg && (
                <div className={`rounded-2xl px-4 py-3 text-sm ${watchState === "failed" ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                  {watchMsg}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a052]">Treatment summary</p>
                <h2 className="mt-2 text-lg font-bold text-zinc-900">Recommended next steps</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  This summary mirrors the recommendation slide so you can review likely next steps, typical visit counts, and the ballpark investment ranges discussed in the video.
                </p>

                {recommendationItems.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {recommendationItems.map((item, idx) => (
                      <div key={`${item.treatment}-${idx}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm font-semibold text-zinc-900">{item.treatment}</p>
                        {item.visits && <p className="mt-1 text-xs text-zinc-500">Visits: {item.visits}</p>}
                        {item.investment && <p className="mt-1 text-xs text-zinc-500">Investment: {item.investment}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400">
                    Your treatment summary will appear here once it is included in the doctor’s presentation workflow.
                  </div>
                )}

                {consultation.summary_slide_data?.notes && (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    {consultation.summary_slide_data.notes}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Need help scheduling?</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  If you are ready to move forward, reply to the email that delivered this video or contact the Destination Smile team so they can help you plan the right next appointment.
                </p>
                <div className="mt-4 space-y-2 text-sm text-zinc-600">
                  {consultation.email && <p><span className="font-medium text-zinc-900">Email:</span> {consultation.email}</p>}
                  {consultation.phone && <p><span className="font-medium text-zinc-900">Phone:</span> {consultation.phone}</p>}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
