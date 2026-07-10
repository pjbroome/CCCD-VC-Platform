"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  getVCRequest,
  listAllSlides,
  listRecordingDecks,
  slideImageUrl,
  photoUrl,
  uploadVideo,
  createConsultation,
  updateVCRequest,
  emailConsultationReview,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck } from "@/lib/api"
import { PhotoEditor } from "@/components/vc/PhotoEditor"

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
  | { kind: "patient"; name: string; photos: string[]; concern: string }
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

  /* photo viewer (read-only zoom/rotate/download; traps keys so slides don't advance) */
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null)

  /* recording state */
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* webcam */
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [bubbleSize, setBubbleSize] = useState<"sm" | "md" | "lg">("md")
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null) // null = default bottom-right
  const draggingBubble = useRef<{ dx: number; dy: number } | null>(null)

  /* MediaRecorder */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compositeStreamRef = useRef<MediaStream | null>(null)

  /* upload state */
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

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
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setCameraReady(true)
      setCameraOn(true)
      setCameraError(null)
    } catch {
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
      setCameraOn(true)
      setCameraError("Camera not available — recording in slide-only mode")
    }
  }, [])

  /* Fully release the webcam — this turns the hardware camera light OFF. */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
    setCameraOn(false)
  }, [])

  const toggleCamera = useCallback(() => {
    if (cameraOn) stopCamera()
    else startCamera()
  }, [cameraOn, startCamera, stopCamera])

  useEffect(() => {
    startCamera()
    /* On leaving the page, ALWAYS release the camera (stops the light). */
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Re-attach the live stream to the <video> when the camera is turned back on. */
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOn])

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

  const patientSlide = useMemo<PresenterSlide | null>(() => {
    if (!request) return null
    return {
      kind: "patient",
      name: getDisplayName(request),
      photos: request.photos || [],
      concern: request.concern || request.message || "",
    }
  }, [request])

  const presenterSlides = useMemo<PresenterSlide[]>(() => {
    const catalogSlides = deckSlides.map((slide) => ({ kind: "catalog", slide }) as PresenterSlide)
    return [...(patientSlide ? [patientSlide] : []), ...catalogSlides, summarySlide]
  }, [deckSlides, summarySlide, patientSlide])

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
  /* Build the recorder from the already-captured tab stream + mic, then start. */
  const startRecorder = useCallback(async (displayStream: MediaStream) => {
    /* Add the doctor's microphone so the walkthrough is narrated. */
    let micTrack: MediaStreamTrack | undefined = streamRef.current?.getAudioTracks?.()[0]
    if (!micTrack) {
      try {
        const a = await navigator.mediaDevices.getUserMedia({ audio: true })
        micTrack = a.getAudioTracks()[0]
      } catch {
        /* no mic — record video only */
      }
    }

    /* Keep the live camera bubble playing (the share prompt can pause it). */
    try { await videoRef.current?.play() } catch { /* ignore */ }

    const tracks: MediaStreamTrack[] = [...displayStream.getVideoTracks()]
    if (micTrack) tracks.push(micTrack)
    const combined = new MediaStream(tracks)
    compositeStreamRef.current = displayStream

    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm"

    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 4_000_000 })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      recordedBlobRef.current = blob
      setReviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
      compositeStreamRef.current?.getTracks().forEach((t) => t.stop())
      compositeStreamRef.current = null
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingState("stopped")
    }

    /* If the doctor uses the browser's own "Stop sharing" control, finalize too. */
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop()
    })

    recorder.start(1000)
    mediaRecorderRef.current = recorder
    setRecordingState("recording")
    setElapsedTime(0)
    timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000)
  }, [])

  /* On click (user gesture): pick the tab to share FIRST, then run the 3-2-1, then record. */
  const beginRecording = useCallback(async () => {
    let displayStream: MediaStream
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: true,
        video: { displaySurface: "browser" },
        audio: false,
      } as MediaStreamConstraints & { preferCurrentTab?: boolean })
    } catch {
      setUploadMsg("Recording needs you to share “This Tab.” Click Start Recording and choose this tab.")
      return
    }
    /* keep the camera bubble alive after the share prompt */
    try { await videoRef.current?.play() } catch { /* ignore */ }
    setCountdown(3)
    let n = 3
    const iv = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(iv)
        setCountdown(null)
        startRecorder(displayStream)
      } else {
        setCountdown(n)
      }
    }, 1000)
  }, [startRecorder])

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
    setReviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
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

      let emailNote = "."
      try {
        const r = await emailConsultationReview(consultation.id)
        emailNote = r.sent ? ` — emailed to ${r.email} for your review.` : " — add an email key to deliver (review link ready)."
      } catch {
        emailNote = " (review link ready)."
      }
      setUploadMsg(`Consultation #${consultation.id} saved${emailNote} Review: /consultation/${consultation.token ?? consultation.id}`)
      stopCamera() // done sending → release the webcam so the light turns off
    } catch (err) {
      setUploadMsg(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setUploading(false)
    }
  }, [request, deckSlides, summaryItems, stopCamera])

  /* ── bubble position cycling ────────────────────────────────── */
  const cycleBubbleSize = useCallback(() => {
    setBubbleSize((s) => (s === "sm" ? "md" : s === "md" ? "lg" : "sm"))
  }, [])

  const bubbleSizeClass = { sm: "size-24", md: "size-36", lg: "size-52" }[bubbleSize]

  const onBubblePointerDown = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    draggingBubble.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onBubblePointerMove = (e: React.PointerEvent) => {
    if (!draggingBubble.current) return
    setBubblePos({ x: e.clientX - draggingBubble.current.dx, y: e.clientY - draggingBubble.current.dy })
  }
  const onBubblePointerUp = (e: React.PointerEvent) => {
    draggingBubble.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

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
      <header className={`flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-2 backdrop-blur-sm ${recordingState === "recording" || recordingState === "paused" ? "hidden" : ""}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href="/staff" className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200">Dashboard</Link>
          <span className="text-zinc-700">·</span>
          <Link href={`/staff/${request.id}`} className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200">Profile</Link>
          <span className="text-zinc-700">·</span>
          <Link href={`/staff/${request.id}/deck`} className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200">Build Deck</Link>
          <span className="text-zinc-700">·</span>
          <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: "var(--k-accent-soft)", color: "var(--k-accent)" }}>Record</span>
          <span className="ml-2 hidden max-w-[200px] truncate text-xs font-bold text-zinc-300 lg:inline">#{request.id} — {getDisplayName(request)}</span>
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
        {/* Patient intro slide — their photos + what they asked us to look at */}
        {currentPresenterSlide?.kind === "patient" && (
          <div className="flex h-full w-full items-center justify-center p-6">
            <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#d8bf7a]">Your Virtual Consultation</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white">{currentPresenterSlide.name}</h2>
                <div className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">What you asked us to look at</p>
                  <p className="mt-2 text-lg leading-relaxed text-zinc-100">{currentPresenterSlide.concern || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {currentPresenterSlide.photos.length > 0 ? (
                  currentPresenterSlide.photos.map((p, i) => (
                    <div key={i} className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-800">
                      {/* blurred self-backdrop fills the tile; the photo shows complete — never crop the smile mid-consult */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(p)} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-lg" />
                      <img
                        src={photoUrl(p)}
                        alt={`Patient photo ${i + 1}`}
                        className="relative max-h-[70vh] h-full w-full cursor-zoom-in object-contain"
                        onClick={() => setViewingPhoto(i)}
                        title="Click to zoom in"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 flex h-48 items-center justify-center rounded-2xl bg-zinc-800 text-sm text-zinc-500">No photos provided</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Slide image */}
        {currentPresenterSlide?.kind === "catalog" && (
          <div className="relative flex h-full w-full items-center justify-center p-1 sm:p-2">
            <img
              src={slideImageUrl(currentPresenterSlide.slide.full_slide_image || currentPresenterSlide.slide.images[0] || "")}
              alt={`Slide ${currentPresenterSlide.slide.slide_number}`}
              className="h-full w-full rounded-lg object-contain shadow-2xl"
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

        {/* 3-2-1 countdown before recording starts */}
        {countdown !== null && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/30">
            <div className="text-[140px] font-bold leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">{countdown}</div>
          </div>
        )}

        {/* Review the just-recorded video before sending */}
        {recordingState === "stopped" && reviewUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-zinc-950/95 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#d8bf7a]">Review your recording</p>
            <video src={reviewUrl} controls autoPlay className="max-h-[70vh] w-auto max-w-full rounded-xl border border-white/10 shadow-2xl" />
            <p className="text-xs text-zinc-400">Watch it through — if it looks good, send it to your email; otherwise delete and re-record.</p>
          </div>
        )}

        {/* ── Webcam bubble — Loom-style: drag anywhere, 3 sizes ─── */}
        {/* z-50 keeps the live camera visible ABOVE the countdown overlay (z-40). */}
        <div
          className="fixed z-50 select-none"
          style={bubblePos ? { left: bubblePos.x, top: bubblePos.y } : { right: 24, bottom: 100 }}
        >
          <div
            className="group relative cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onBubblePointerDown}
            onPointerMove={onBubblePointerMove}
            onPointerUp={onBubblePointerUp}
            title="Drag to move"
          >
            {recordingState === "recording" && <div className="absolute -inset-1 animate-pulse rounded-full border-2 border-red-500/50" />}
            <div className={`${bubbleSizeClass} relative overflow-hidden rounded-full border-2 border-white/20 bg-zinc-800 shadow-xl`}>
              {cameraError ? (
                <div className="flex size-full items-center justify-center p-2 text-center text-[10px] text-zinc-500">{cameraError}</div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="size-full scale-x-[-1] object-cover" />
                  {!cameraOn && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={startCamera}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900 text-zinc-400 transition hover:text-white"
                      title="Turn camera on"
                    >
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                      </svg>
                      <span className="text-[8px] font-semibold uppercase tracking-wide">Camera off</span>
                    </button>
                  )}
                </>
              )}
            </div>
            {recordingState === "recording" && (
              <div className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-red-500">
                <div className="size-2 rounded-sm bg-white" />
              </div>
            )}
            {/* power toggle — turn the camera OFF (releases the light); hidden while recording */}
            {cameraOn && recordingState !== "recording" && recordingState !== "paused" && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={stopCamera}
                title="Turn camera off"
                className="absolute -top-1 -left-1 flex size-6 items-center justify-center rounded-full bg-zinc-900/90 text-white shadow ring-1 ring-white/20 transition hover:bg-red-600"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                </svg>
              </button>
            )}
            {/* size toggle (doesn't start a drag) */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={cycleBubbleSize}
              title="Change bubble size"
              className="absolute -bottom-1 -left-1 flex size-6 items-center justify-center rounded-full bg-zinc-900/90 text-[9px] font-bold uppercase text-white shadow ring-1 ring-white/20 transition hover:bg-zinc-700"
            >
              {bubbleSize}
            </button>
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
        <div className={`gap-1.5 overflow-x-auto px-4 py-2 ${recordingState === "recording" || recordingState === "paused" ? "hidden" : "flex"}`}>
          {presenterSlides.map((slide, idx) => (
            <button
              key={`ps-${idx}`}
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
              ) : slide.kind === "patient" ? (
                slide.photos[0] ? (
                  <img src={photoUrl(slide.photos[0])} alt="Patient" className="h-12 w-20 object-cover" />
                ) : (
                  <div className="flex h-12 w-20 items-center justify-center bg-zinc-700 text-[8px] font-semibold text-white">Patient</div>
                )
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
              onClick={beginRecording}
              disabled={!cameraReady || presenterSlides.length === 0 || countdown !== null}
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
                    Send to my email
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
                Delete &amp; re-record
              </button>
              <span className="text-xs text-zinc-500">
                {formatTime(elapsedTime)} recorded
              </span>
            </>
          )}

          {(recordingState === "idle" || recordingState === "stopped") && (
            <button
              type="button"
              onClick={toggleCamera}
              title={cameraOn ? "Turn the webcam off (releases the camera light)" : "Turn the webcam back on"}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all ${
                cameraOn
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-[#c4a052] text-zinc-900 hover:bg-[#d8bf7a]"
              }`}
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
              </svg>
              {cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
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

      {/* Photo viewer — read-only during a presentation (no persist), zoom/rotate/download */}
      {viewingPhoto !== null && currentPresenterSlide?.kind === "patient" && currentPresenterSlide.photos[viewingPhoto] && (
        <PhotoEditor
          photoPath={currentPresenterSlide.photos[viewingPhoto]}
          label={`Patient photo ${viewingPhoto + 1}`}
          position={`${viewingPhoto + 1} of ${currentPresenterSlide.photos.length}`}
          onClose={() => setViewingPhoto(null)}
          onPrev={viewingPhoto > 0 ? () => setViewingPhoto(viewingPhoto - 1) : undefined}
          onNext={viewingPhoto < currentPresenterSlide.photos.length - 1 ? () => setViewingPhoto(viewingPhoto + 1) : undefined}
        />
      )}

      {/* Hidden canvas for composite recording (future enhancement) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
