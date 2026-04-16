"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  getVCRequest,
  listAllSlides,
  listRecordingDecks,
  slideImageUrl,
  uploadVideo,
  createConsultation,
  updateVCRequest,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck } from "@/lib/api"

/* ── helpers ─────────────────────────────────────────────────── */

function getDisplayName(r: VCRequestListItem) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  if (r.patient_name) return r.patient_name
  return "Unknown"
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/* ── types ───────────────────────────────────────────────────── */

type RecordingState = "idle" | "recording" | "paused" | "stopped"

type SummaryItem = {
  treatment: string
  visits?: string
  investment?: string
}

type RecommendationPreset = {
  id: string
  treatment: string
  visits: string
  investment: string
  enabled: boolean
}

type PresenterSlide =
  | { kind: "catalog"; slide: SlideItem }
  | { kind: "summary"; title: string; items: SummaryItem[]; notes?: string }

const DEFAULT_SUMMARY_SLIDE = {
  title: "Treatment Suggestions Summary",
  items: [
    { treatment: "New Patient Evaluation (NPE)", visits: "1 visit · reserve 1.5 hrs", investment: "$500" },
    { treatment: "Bleaching", visits: "1 visit", investment: "$450 to $650" },
    { treatment: "Icon / Remineralization", visits: "1 visit", investment: "Case dependent" },
    { treatment: "Invisalign", visits: "3 avg visits", investment: "$7,500 to $9,500" },
    { treatment: "Smile Project", visits: "3 visits", investment: "$12k to $35k" },
    { treatment: "Rescue / Complex Implant Prosthetic Project", visits: "Case dependent", investment: "$65k to $145k+" },
  ],
  notes: "Reply to your consultation email or contact Destination Smile when you are ready to schedule the next step.",
} satisfies { title: string; items: SummaryItem[]; notes: string }

type DraftDeckState = {
  slide_numbers: number[]
  recommendation_items?: RecommendationPreset[]
  updated_at: string
}

function draftDeckStorageKey(requestId: number) {
  return `vc-draft-deck:${requestId}`
}

function readDraftDeck(requestId: number): DraftDeckState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(draftDeckStorageKey(requestId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftDeckState
    if (!Array.isArray(parsed.slide_numbers)) return null
    return parsed
  } catch {
    return null
  }
}

function resolveDeckSlides(slideNumbers: number[], slideMap: Map<number, SlideItem>) {
  return slideNumbers.map((n) => slideMap.get(n)).filter(Boolean) as SlideItem[]
}

function resolveSummaryItems(recommendationItems?: RecommendationPreset[]): SummaryItem[] {
  if (!recommendationItems?.length) return DEFAULT_SUMMARY_SLIDE.items
  const selectedItems = recommendationItems
    .filter((item) => item.enabled && item.treatment.trim())
    .map((item) => ({
      treatment: item.treatment.trim(),
      visits: item.visits.trim(),
      investment: item.investment.trim(),
    }))

  return selectedItems.length > 0 ? selectedItems : DEFAULT_SUMMARY_SLIDE.items
}

/* ── main page ───────────────────────────────────────────────── */

export default function PresenterViewPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = Number(params.id)

  /* data */
  const [request, setRequest] = useState<VCRequestListItem | null>(null)
  const [deckSlides, setDeckSlides] = useState<SlideItem[]>([])
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>(DEFAULT_SUMMARY_SLIDE.items)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* slide navigation */
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0)

  /* recording state */
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* webcam */
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [bubblePosition, setBubblePosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">("bottom-right")

  /* MediaRecorder */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compositeStreamRef = useRef<MediaStream | null>(null)

  /* upload state */
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)

  /* ── load data ─────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      try {
        const [reqData, slideData, deckData] = await Promise.all([
          getVCRequest(requestId),
          listAllSlides(),
          listRecordingDecks(),
        ])
        setRequest(reqData)

        const slideMap = new Map(slideData.slides.map((s: SlideItem) => [s.slide_number, s]))
        const existingDeck = reqData.deck_id
          ? deckData.decks.find((d: RecordingDeck) => d.id === reqData.deck_id) ?? null
          : null
        const draftDeck = reqData.status === "sent" ? null : readDraftDeck(requestId)

        const resolvedDraft = draftDeck?.slide_numbers?.length
          ? resolveDeckSlides(draftDeck.slide_numbers, slideMap)
          : []
        const resolvedPersisted = existingDeck ? resolveDeckSlides(existingDeck.slide_numbers, slideMap) : []
        const resolvedDeck = resolvedDraft.length > 0 ? resolvedDraft : resolvedPersisted

        setDeckSlides(resolvedDeck)
        setSummaryItems(resolveSummaryItems(draftDeck?.recommendation_items))

        if (resolvedDeck.length === 0) {
          setError("No deck assigned to this request yet. Build your slideshow first, then return to record.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    if (requestId && !isNaN(requestId)) load()
  }, [requestId])

  /* ── webcam setup (with canvas fallback when no camera) ───── */
  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: true,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraReady(true)
      } catch (err) {
        /* Camera unavailable — create a canvas-based fallback stream
           so recording still works (slide-only mode). */
        const fallbackCanvas = document.createElement("canvas")
        fallbackCanvas.width = 640
        fallbackCanvas.height = 480
        const ctx = fallbackCanvas.getContext("2d")
        if (ctx) {
          ctx.fillStyle = "#18181b"
          ctx.fillRect(0, 0, 640, 480)
          ctx.fillStyle = "#c4a052"
          ctx.font = "bold 24px sans-serif"
          ctx.textAlign = "center"
          ctx.fillText("Slide-Only Recording", 320, 230)
          ctx.font = "14px sans-serif"
          ctx.fillStyle = "#a1a1aa"
          ctx.fillText("Camera not available", 320, 260)
        }
        const fallbackStream = fallbackCanvas.captureStream(1)
        streamRef.current = fallbackStream
        setCameraReady(true)
        setCameraError(
          "Camera not available — recording in slide-only mode"
        )
      }
    }
    initCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  /* ── slide navigation ──────────────────────────────────────── */
  const summarySlide = useMemo<PresenterSlide>(
    () => ({
      kind: "summary",
      title: DEFAULT_SUMMARY_SLIDE.title,
      items: summaryItems,
      notes: DEFAULT_SUMMARY_SLIDE.notes,
    }),
    [summaryItems]
  )

  const presenterSlides = useMemo<PresenterSlide[]>(() => {
    const catalogSlides = deckSlides.map((slide) => ({ kind: "catalog", slide }) as PresenterSlide)
    return [...catalogSlides, summarySlide]
  }, [deckSlides, summarySlide])

  const currentPresenterSlide = presenterSlides[currentSlideIdx] || null

  const goNext = useCallback(() => {
    setCurrentSlideIdx((prev) => Math.min(prev + 1, presenterSlides.length - 1))
  }, [presenterSlides.length])

  const goPrev = useCallback(() => {
    setCurrentSlideIdx((prev) => Math.max(prev - 1, 0))
  }, [])

  /* keyboard navigation */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        goNext()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [goNext, goPrev])

  /* ── recording controls ────────────────────────────────────── */
  const startRecording = useCallback(async () => {
    if (!streamRef.current) return

    chunksRef.current = []

    /* Use camera+audio stream directly for MVP */
    const stream = streamRef.current
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm"

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      recordedBlobRef.current = blob
      setRecordingState("stopped")
    }

    recorder.start(1000) // collect data every second
    mediaRecorderRef.current = recorder
    setRecordingState("recording")
    setElapsedTime(0)

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.pause()
      setRecordingState("paused")
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [recordingState])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "paused") {
      mediaRecorderRef.current.resume()
      setRecordingState("recording")
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    }
  }, [recordingState])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState !== "idle" && recordingState !== "stopped") {
      mediaRecorderRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [recordingState])

  const discardRecording = useCallback(() => {
    recordedBlobRef.current = null
    chunksRef.current = []
    setRecordingState("idle")
    setElapsedTime(0)
    setUploadMsg(null)
  }, [])

  /* ── upload recording ──────────────────────────────────────── */
  const saveRecording = useCallback(async () => {
    if (!recordedBlobRef.current || !request) return

    setUploading(true)
    setUploadMsg(null)

    try {
      const file = new File(
        [recordedBlobRef.current],
        `consultation_${request.id}_${Date.now()}.webm`,
        { type: recordedBlobRef.current.type }
      )

      const uploaded = await uploadVideo(file)

        const consultation = await createConsultation({
          request_id: request.id,
          patient_name: getDisplayName(request),
          email: request.email,
          phone: request.phone,
          video_url: uploaded.url,
          video_source: "browser_recording",
          slide_numbers: deckSlides.map((s) => s.slide_number),
          summary_slide_data: {
            items: summaryItems,
            notes: DEFAULT_SUMMARY_SLIDE.notes,
          },
        })


      await updateVCRequest(request.id, {
        consultation_id: consultation.id,
        status: "recording_ready",
      })

      setUploadMsg(`Consultation #${consultation.id} saved and ready to send. Patient receipt: /consultation/${consultation.id}`)
    } catch (err) {
      setUploadMsg(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setUploading(false)
    }
  }, [request, deckSlides])

  /* ── bubble position cycling ────────────────────────────────── */
  const cycleBubblePosition = useCallback(() => {
    const positions: typeof bubblePosition[] = [
      "bottom-right",
      "bottom-left",
      "top-left",
      "top-right",
    ]
    const idx = positions.indexOf(bubblePosition)
    setBubblePosition(positions[(idx + 1) % positions.length])
  }, [bubblePosition])

  const bubblePositionClass = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  }[bubblePosition]

  /* ── loading / error states ────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-900">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading presenter view...</span>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-900 px-4">
        <p className="text-sm font-medium text-red-400">{error || "Request not found"}</p>
        <Link href={`/staff/${requestId}/deck`} className="mt-4 text-sm text-[#c4a052] underline">
          Back to Deck Builder
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-900">
      {/* ── Top bar ────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/staff/${request.id}/deck`}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to Builder
          </Link>
          <span className="text-zinc-700">/</span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">
              Presenter View
            </p>
            <p className="text-xs font-bold text-zinc-200">
              #{request.id} — {getDisplayName(request)}
            </p>
          </div>
        </div>

        {/* Slide counter + timer */}
        <div className="flex items-center gap-4">
          <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300">
            {currentSlideIdx + 1} / {presenterSlides.length}
          </span>
          {recordingState !== "idle" && (
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${
                  recordingState === "recording"
                    ? "animate-pulse bg-red-500"
                    : recordingState === "paused"
                      ? "bg-amber-500"
                      : "bg-zinc-500"
                }`}
              />
              <span className="font-mono text-xs text-zinc-300">{formatTime(elapsedTime)}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main slide area ────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Slide image */}
        {currentPresenterSlide?.kind === "catalog" && (
          <div className="relative flex h-full w-full items-center justify-center p-4">
            <img
              src={slideImageUrl(currentPresenterSlide.slide.full_slide_image || currentPresenterSlide.slide.images[0] || "")}
              alt={`Slide ${currentPresenterSlide.slide.slide_number}`}
              className="max-h-[calc(100vh-180px)] max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        )}

        {currentPresenterSlide?.kind === "summary" && (
          <div className="flex h-full w-full items-center justify-center p-6">
            <div className="grid w-full max-w-6xl gap-6 rounded-[32px] border border-[#c4a052]/20 bg-gradient-to-br from-[#fffaf1] via-white to-[#f7efe0] p-8 text-zinc-900 shadow-2xl lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9a7b2f]">
                  Destination Smile
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900">
                  {currentPresenterSlide.title}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
                  Review the recommended next steps, expected visit flow, and ballpark investment ranges discussed in your consultation.
                </p>

                <div className="mt-6 overflow-hidden rounded-3xl border border-[#c4a052]/15 bg-white shadow-sm">
                  <div className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <span>Treatment</span>
                    <span>Visits</span>
                    <span>Investment</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {currentPresenterSlide.items.length > 0 ? (
                      currentPresenterSlide.items.map((item) => (
                        <div key={item.treatment} className="grid grid-cols-[1.3fr_1fr_1fr] gap-4 px-5 py-4 text-sm">
                          <div className="font-semibold text-zinc-900">{item.treatment}</div>
                          <div className="text-zinc-600">{item.visits || "—"}</div>
                          <div className="text-zinc-700">{item.investment || "—"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-6 text-sm text-zinc-500">No treatment options selected yet. Return to the deck builder to choose the final suggestion items.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#c4a052]/15 bg-zinc-950 p-6 text-white shadow-lg">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#d8bf7a]">
                    Recommended next step
                  </p>
                  <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <p className="text-sm text-zinc-300">Default most common next appointment</p>
                    <p className="mt-2 text-2xl font-semibold text-white">New Patient Evaluation (NPE)</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      Reserve 1.5 hours. Most patients pre-op and begin the treatment workflow from this visit.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#c4a052]/10 p-4 ring-1 ring-[#c4a052]/25">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e9d19a]">
                    Notes
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-200">
                    {currentPresenterSlide.notes}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Webcam bubble (Loom-style) ───────────────────────── */}
        <div
          className={`absolute ${bubblePositionClass} z-30 cursor-pointer transition-all duration-300`}
          onClick={cycleBubblePosition}
          title="Click to move bubble"
        >
          <div className="relative">
            {/* Ring animation when recording */}
            {recordingState === "recording" && (
              <div className="absolute -inset-1 animate-pulse rounded-full border-2 border-red-500/50" />
            )}
            <div className="size-36 overflow-hidden rounded-full border-2 border-white/20 bg-zinc-800 shadow-xl">
              {cameraError ? (
                <div className="flex size-full items-center justify-center text-[10px] text-zinc-500">
                  {cameraError}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="size-full scale-x-[-1] object-cover"
                />
              )}
            </div>
            {/* Recording indicator */}
            {recordingState === "recording" && (
              <div className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-red-500">
                <div className="size-2 rounded-sm bg-white" />
              </div>
            )}
          </div>
        </div>

        {/* ── Slide navigation arrows ──────────────────────────── */}
        <button
          onClick={goPrev}
          disabled={currentSlideIdx === 0}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-800/80 p-3 text-zinc-400 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-700 hover:text-white disabled:invisible"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={currentSlideIdx >= presenterSlides.length - 1}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-zinc-800/80 p-3 text-zinc-400 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-700 hover:text-white disabled:invisible"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* ── Bottom controls bar ────────────────────────────────── */}
      <div className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        {/* Slide filmstrip */}
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2">
          {presenterSlides.map((slide, idx) => (
            <button
              key={slide.kind === "catalog" ? slide.slide.slide_number : "summary-slide"}
              onClick={() => setCurrentSlideIdx(idx)}
              className={`flex-shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                idx === currentSlideIdx
                  ? "border-[#c4a052] shadow-lg shadow-[#c4a052]/20"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {slide.kind === "catalog" ? (
                <img
                  src={slideImageUrl(slide.slide.full_slide_image || slide.slide.images[0] || "")}
                  alt={`Slide ${slide.slide.slide_number}`}
                  className="h-12 w-20 object-cover"
                />
              ) : (
                <div className="flex h-12 w-20 flex-col justify-between bg-gradient-to-br from-[#2a2414] via-[#5c4720] to-[#c4a052] p-2 text-left text-white">
                  <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-white/80">Summary</span>
                  <span className="line-clamp-2 text-[8px] font-semibold leading-tight">Treatment Suggestions</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Recording controls */}
        <div className="flex items-center justify-center gap-3 border-t border-zinc-800/50 px-4 py-3">
          {recordingState === "idle" && (
            <button
              onClick={startRecording}
              disabled={!cameraReady || presenterSlides.length === 0}
              className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-red-500 disabled:opacity-40"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Start Recording
            </button>
          )}

          {recordingState === "recording" && (
            <>
              <button
                onClick={pauseRecording}
                className="flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-amber-500"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                Pause
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-full bg-zinc-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-zinc-600"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                End Recording
              </button>
            </>
          )}

          {recordingState === "paused" && (
            <>
              <button
                onClick={resumeRecording}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-red-500"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="8" />
                </svg>
                Resume
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-full bg-zinc-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-zinc-600"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                End Recording
              </button>
            </>
          )}

          {recordingState === "stopped" && (
            <>
              <button
                onClick={saveRecording}
                disabled={uploading}
                className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-emerald-500 disabled:opacity-40"
              >
                {uploading ? (
                  <>
                    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    Send
                  </>
                )}
              </button>
              <button
                onClick={discardRecording}
                disabled={uploading}
                className="flex items-center gap-2 rounded-full bg-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 shadow-lg transition-all hover:bg-zinc-600 disabled:opacity-40"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Discard
              </button>
              <span className="text-xs text-zinc-500">
                {formatTime(elapsedTime)} recorded
              </span>
            </>
          )}

          {uploadMsg && (
            <span
              className={`ml-3 text-xs font-medium ${
                uploadMsg.includes("failed") ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {uploadMsg}
            </span>
          )}
        </div>
      </div>

      {/* Hidden canvas for composite recording (future enhancement) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
