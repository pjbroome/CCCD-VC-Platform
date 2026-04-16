"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  getVCRequest,
  listAllSlides,
  slideImageUrl,
  createRecordingDeck,
  listRecordingDecks,
  deleteRecordingDeck,
  updateVCRequest,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck } from "@/lib/api"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Slider } from "@/components/ui/slider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type GalleryMode = "grid" | "strip"

type RecommendationPreset = {
  id: string
  treatment: string
  visits: string
  investment: string
  enabled: boolean
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getDisplayName(r: VCRequestListItem) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  if (r.patient_name) return r.patient_name
  return "Unknown"
}

function getSlideTitle(slide: SlideItem) {
  return slide.condition || slide.solution || statusLabel(slide.slide_type || "slide")
}

const TREATMENT_OPTIONS = [
  "no_prep_veneers",
  "invisalign",
  "bonding",
  "whitening",
  "full_mouth_rejuvenation",
  "implants",
  "gum_lift",
  "minimal_prep_veneers",
  "maryland_bridge",
  "icon",
  "general",
] as const

const CONCERN_OPTIONS = [
  "confidence",
  "general_enhancement",
  "discoloration",
  "gummy_smile",
  "worn_teeth",
  "trauma",
  "bad_previous_work",
  "missing_teeth",
  "bite_issues",
  "sensitivity",
  "crowding",
  "small_teeth",
  "spacing",
  "decay",
] as const

const QUICK_FILTERS = [
  { label: "Whitening", treatment: "whitening", searchText: "" },
  { label: "Invisalign", treatment: "invisalign", searchText: "" },
  { label: "Icon / Remin", treatment: "icon", searchText: "" },
  { label: "Smile Project", treatment: "full_mouth_rejuvenation", searchText: "smile" },
] as const

const DEFAULT_RECOMMENDATIONS: RecommendationPreset[] = [
  { id: "npe", treatment: "New Patient Evaluation (NPE)", visits: "1 visit · reserve 1.5 hrs", investment: "$500", enabled: true },
  { id: "bleaching", treatment: "Bleaching", visits: "1 visit", investment: "$450 to $650", enabled: true },
  { id: "icon", treatment: "Icon / Remineralization", visits: "1 visit", investment: "Case dependent", enabled: true },
  { id: "invisalign", treatment: "Invisalign", visits: "3 avg visits", investment: "$7,500 to $9,500", enabled: true },
  { id: "smile-project", treatment: "Smile Project", visits: "3 visits", investment: "$12k to $35k", enabled: true },
  { id: "rescue", treatment: "Rescue / Complex Implant Prosthetic Project", visits: "Case dependent", investment: "$65k to $145k+", enabled: true },
]

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

function writeDraftDeck(requestId: number, slideNumbers: number[], recommendationItems: RecommendationPreset[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    draftDeckStorageKey(requestId),
    JSON.stringify({
      slide_numbers: slideNumbers,
      recommendation_items: recommendationItems,
      updated_at: new Date().toISOString(),
    } satisfies DraftDeckState)
  )
}

function clearDraftDeck(requestId: number) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(draftDeckStorageKey(requestId))
}

function resolveDeckSlides(slideNumbers: number[], slideMap: Map<number, SlideItem>) {
  return slideNumbers.map((n) => slideMap.get(n)).filter(Boolean) as SlideItem[]
}

function SlidePreviewImage({ slide, className }: { slide: SlideItem; className: string }) {
  const primary = slide.full_slide_image || slide.images[0]

  return (
    <div className={`overflow-hidden bg-zinc-100 ${className}`}>
      {primary ? (
        <img
          src={slideImageUrl(primary)}
          alt={`Slide ${slide.slide_number}`}
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = "none"
            if (target.parentElement) {
              target.parentElement.innerHTML = `<div class=\"flex h-full w-full items-center justify-center text-xs font-mono text-zinc-400\">#${slide.slide_number}</div>`
            }
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-mono text-zinc-400">
          #{slide.slide_number}
        </div>
      )}
    </div>
  )
}

function DeckBuilderPanel({
  request,
  deckSlides,
  existingDeckId,
  saving,
  saveDeck,
  moveSlide,
  removeFromDeck,
  setPreviewSlide,
  handleDragStart,
  handleDragOver,
  handleDrop,
  recommendations,
  setRecommendations,
}: {
  request: VCRequestListItem
  deckSlides: SlideItem[]
  existingDeckId: number | null
  saving: boolean
  saveDeck: () => void
  moveSlide: (from: number, to: number) => void
  removeFromDeck: (slideNumber: number) => void
  setPreviewSlide: (slide: SlideItem | null) => void
  handleDragStart: (idx: number) => void
  handleDragOver: (e: React.DragEvent, idx: number) => void
  handleDrop: () => void
  recommendations: RecommendationPreset[]
  setRecommendations: React.Dispatch<React.SetStateAction<RecommendationPreset[]>>
}) {
  const selectedRecommendationCount = recommendations.filter((item) => item.enabled).length

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-zinc-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              Patient Deck ({deckSlides.length} slide{deckSlides.length !== 1 ? "s" : ""})
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Keep this list in the exact vertical order you want to scroll and record. Your draft stays visible here until the consultation is sent.
            </p>
          </div>
          {existingDeckId && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
              Deck #{existingDeckId}
            </span>
          )}
        </div>
      </div>

      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Final suggestion slide presets</p>
              <p className="mt-1 text-[11px] text-zinc-600">
                Choose which items appear on the final slide, then add, edit, or remove options as needed.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
              {selectedRecommendationCount} shown
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {recommendations.map((item, idx) => (
              <div key={item.id} className="rounded-lg border border-amber-200/70 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[12px] font-medium text-zinc-800">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) =>
                        setRecommendations((prev) =>
                          prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, enabled: e.target.checked } : row))
                        )
                      }
                      className="size-4 rounded border-zinc-300 text-[#c4a052] focus:ring-[#c4a052]"
                    />
                    Show on final slide
                  </label>
                  <button
                    type="button"
                    onClick={() => setRecommendations((prev) => prev.filter((row) => row.id !== item.id))}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  <input
                    value={item.treatment}
                    onChange={(e) =>
                      setRecommendations((prev) =>
                        prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, treatment: e.target.value } : row))
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:border-[#c4a052] focus:outline-none"
                    placeholder="Suggested treatment"
                  />
                  <input
                    value={item.visits}
                    onChange={(e) =>
                      setRecommendations((prev) =>
                        prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, visits: e.target.value } : row))
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:border-[#c4a052] focus:outline-none"
                    placeholder="Visits"
                  />
                  <input
                    value={item.investment}
                    onChange={(e) =>
                      setRecommendations((prev) =>
                        prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, investment: e.target.value } : row))
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:border-[#c4a052] focus:outline-none"
                    placeholder="Investment"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setRecommendations((prev) => [
                ...prev,
                {
                  id: `custom-${Date.now()}`,
                  treatment: "",
                  visits: "",
                  investment: "",
                  enabled: true,
                },
              ])
            }
            className="mt-3 w-full rounded-lg border border-dashed border-amber-300 bg-white/70 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-white"
          >
            Add suggestion option
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {deckSlides.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-zinc-100">
              <svg className="size-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-600">Deck is empty</p>
            <p className="mt-1 text-xs text-zinc-400">Select slides from the library, then arrange them here for your recording flow.</p>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-3">
            {deckSlides.map((slide, idx) => (
              <div
                key={`${slide.slide_number}-${idx}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-colors hover:border-[#c4a052]/40 hover:bg-zinc-50"
              >
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                      className="cursor-grab rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing"
                      title="Drag to reorder"
                      type="button"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    </button>
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#c4a052]/10 text-[10px] font-bold text-[#c4a052]">
                      {idx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewSlide(slide)}
                    className="overflow-hidden rounded-lg border border-zinc-200 transition hover:border-[#c4a052]/40"
                  >
                    <SlidePreviewImage slide={slide} className="h-20 w-24" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span className="font-mono">#{slide.slide_number}</span>
                      <span>{statusLabel(slide.slide_type || "slide")}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-zinc-800">{getSlideTitle(slide)}</p>
                    {slide.solution && slide.solution !== slide.condition && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{slide.solution}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {slide.treatments.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600">
                          {statusLabel(t)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => idx > 0 && moveSlide(idx, idx - 1)}
                      disabled={idx === 0}
                      className="rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 disabled:opacity-30"
                      type="button"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => idx < deckSlides.length - 1 && moveSlide(idx, idx + 1)}
                      disabled={idx === deckSlides.length - 1}
                      className="rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 disabled:opacity-30"
                      type="button"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeFromDeck(slide.slide_number)}
                      className="rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500"
                      title="Remove from deck"
                      type="button"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 bg-white px-4 py-3">
        <div className="flex flex-col gap-2">
          <button
            onClick={saveDeck}
            disabled={saving || deckSlides.length === 0}
            className="w-full rounded-lg bg-[#c4a052] py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#b8933f] disabled:opacity-40"
            type="button"
          >
            {saving ? "Saving..." : existingDeckId ? `Save Final Deck #${existingDeckId}` : "Save Final Deck"}
          </button>
          {deckSlides.length > 0 && (
            <Link
              href={`/staff/${request.id}/deck/present`}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-700"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Present & Record
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DeckBuilderPage() {
  const params = useParams()
  const requestId = Number(params.id)

  const [request, setRequest] = useState<VCRequestListItem | null>(null)
  const [allSlides, setAllSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchText, setSearchText] = useState("")
  const [treatmentFilter, setTreatmentFilter] = useState("")
  const [concernFilter, setConcernFilter] = useState("")
  const [galleryMode, setGalleryMode] = useState<GalleryMode>("grid")
  const [thumbnailSize, setThumbnailSize] = useState(220)
  const [builderOpen, setBuilderOpen] = useState(false)

  const [recommendations, setRecommendations] = useState<RecommendationPreset[]>(DEFAULT_RECOMMENDATIONS)
  const [deckSlides, setDeckSlides] = useState<SlideItem[]>([])
  const [existingDeckId, setExistingDeckId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [previewSlide, setPreviewSlide] = useState<SlideItem | null>(null)

  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)
  const initializedDraftRef = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const [reqData, slideData, deckData] = await Promise.all([
          getVCRequest(requestId),
          listAllSlides(),
          listRecordingDecks(),
        ])
        setRequest(reqData)
        setAllSlides(slideData.slides)

        const slideMap = new Map(slideData.slides.map((s: SlideItem) => [s.slide_number, s]))
        const existingDeck = reqData.deck_id
          ? deckData.decks.find((d: RecordingDeck) => d.id === reqData.deck_id) ?? null
          : null

        setExistingDeckId(existingDeck?.id ?? null)

        if (reqData.status === "sent") {
          clearDraftDeck(requestId)
        }

        const draftDeck = reqData.status === "sent" ? null : readDraftDeck(requestId)

        if (draftDeck?.recommendation_items?.length) {
          setRecommendations(draftDeck.recommendation_items)
        } else {
          setRecommendations(DEFAULT_RECOMMENDATIONS)
        }

        if (draftDeck?.slide_numbers?.length) {
          setDeckSlides(resolveDeckSlides(draftDeck.slide_numbers, slideMap))
          setSaveMsg("Loaded your in-progress slideshow draft. You can keep editing and save once when ready.")
        } else if (existingDeck) {
          setDeckSlides(resolveDeckSlides(existingDeck.slide_numbers, slideMap))
        } else {
          setDeckSlides([])
        }

        initializedDraftRef.current = true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    if (requestId && !isNaN(requestId)) load()
  }, [requestId])

  useEffect(() => {
    if (!initializedDraftRef.current || !requestId || Number.isNaN(requestId)) return
    if (request?.status === "sent") {
      clearDraftDeck(requestId)
      return
    }

    if (deckSlides.length > 0 || recommendations.length > 0) {
      writeDraftDeck(
        requestId,
        deckSlides
          .filter((slide) => slide.slide_type !== "summary")
          .map((slide) => slide.slide_number),
        recommendations
      )
    } else {
      clearDraftDeck(requestId)
    }
  }, [requestId, request?.status, deckSlides, recommendations])

  const filteredSlides = useMemo(() => {
    return allSlides.filter((s) => {
      const inDeck = deckSlides.some((d) => d.slide_number === s.slide_number)
      if (inDeck) return false

      if (treatmentFilter && !s.treatments.includes(treatmentFilter)) return false
      if (concernFilter && !s.concerns.includes(concernFilter)) return false

      if (searchText) {
        const q = searchText.toLowerCase()
        const haystack = [
          s.condition,
          s.solution,
          ...s.treatments,
          ...s.concerns,
          ...s.text_content,
          String(s.slide_number),
          s.slide_type,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allSlides, deckSlides, treatmentFilter, concernFilter, searchText])

  const addToDeck = useCallback(
    (slide: SlideItem) => {
      if (deckSlides.some((d) => d.slide_number === slide.slide_number)) return
      setDeckSlides((prev) => [...prev, slide])
      setSaveMsg(null)
    },
    [deckSlides]
  )

  const removeFromDeck = useCallback((slideNumber: number) => {
    setDeckSlides((prev) => prev.filter((s) => s.slide_number !== slideNumber))
    setSaveMsg(null)
  }, [])

  const moveSlide = useCallback((from: number, to: number) => {
    setDeckSlides((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    })
    setSaveMsg(null)
  }, [])

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    dragOverIdx.current = idx
  }

  const handleDrop = () => {
    if (dragIdx.current !== null && dragOverIdx.current !== null && dragIdx.current !== dragOverIdx.current) {
      moveSlide(dragIdx.current, dragOverIdx.current)
    }
    dragIdx.current = null
    dragOverIdx.current = null
  }

  const saveDeck = useCallback(async () => {
    if (!request || deckSlides.length === 0) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const name = `Request #${request.id} — ${getDisplayName(request)}`
      const slideNumbers = deckSlides.map((s) => s.slide_number)

      if (existingDeckId) {
        try {
          await deleteRecordingDeck(existingDeckId)
        } catch {
          // ignore if already deleted
        }
      }

      const newDeck = await createRecordingDeck(name, slideNumbers)
      setExistingDeckId(newDeck.id)
      await updateVCRequest(request.id, { deck_id: newDeck.id })
      setRequest((prev) => (prev ? { ...prev, deck_id: newDeck.id } : prev))
      writeDraftDeck(request.id, slideNumbers, recommendations)
      setSaveMsg(`Final deck saved (${slideNumbers.length} slides) — ID #${newDeck.id}`)
    } catch (err) {
      setSaveMsg(`Save failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setSaving(false)
    }
  }, [request, deckSlides, existingDeckId, recommendations])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading deck builder...</span>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4">
        <p className="text-sm font-medium text-red-600">{error || "Request not found"}</p>
        <Link href="/staff" className="mt-4 text-sm text-[#c4a052] underline">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/staff/${request.id}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Profile
            </Link>
            <span className="text-zinc-200">/</span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">Doctor Workspace</p>
              <p className="truncate text-sm font-bold text-zinc-900">#{request.id} — {getDisplayName(request)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 lg:hidden"
            >
              Open Builder ({deckSlides.length})
            </button>
            {deckSlides.length > 0 && (
              <Link
                href={`/staff/${request.id}/deck/present`}
                className="hidden items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 sm:flex"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
                Present
              </Link>
            )}
            <button
              onClick={saveDeck}
              disabled={saving || deckSlides.length === 0}
              className="rounded-lg bg-[#c4a052] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#b8933f] disabled:opacity-40"
              type="button"
            >
              {saving ? "Saving..." : existingDeckId ? "Save Final Deck" : "Save Final Deck"}
            </button>
          </div>
        </div>
        {saveMsg && (
          <div
            className={`border-t px-4 py-2 text-xs font-medium ${
              saveMsg.startsWith("Save failed") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {saveMsg}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100dvh-110px)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <ResizablePanel defaultSize={68} minSize={50}>
            <div className="flex h-full min-w-0 flex-col bg-white">
              <div className="border-b border-zinc-100 px-4 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">Slide Library</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Browse larger slides, filter quickly, and add only the cases you want to present.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGalleryMode("grid")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${galleryMode === "grid" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500"}`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryMode("strip")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${galleryMode === "strip" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500"}`}
                    >
                      Horizontal Row
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.65fr))]">
                  <input
                    type="text"
                    placeholder="Search slides by condition, treatment, slide #, or solution..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-300 focus:border-[#c4a052] focus:outline-none focus:ring-1 focus:ring-[#c4a052]/30"
                  />
                  <select
                    value={treatmentFilter}
                    onChange={(e) => setTreatmentFilter(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-600 focus:border-[#c4a052] focus:outline-none"
                  >
                    <option value="">All Treatments</option>
                    {TREATMENT_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {statusLabel(t)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={concernFilter}
                    onChange={(e) => setConcernFilter(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-600 focus:border-[#c4a052] focus:outline-none"
                  >
                    <option value="">All Concerns</option>
                    {CONCERN_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {statusLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FILTERS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setTreatmentFilter(item.treatment)
                          setSearchText(item.searchText)
                        }}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-[#c4a052]/40 hover:bg-amber-50 hover:text-zinc-900"
                      >
                        {item.label}
                      </button>
                    ))}
                    {(searchText || treatmentFilter || concernFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchText("")
                          setTreatmentFilter("")
                          setConcernFilter("")
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="min-w-[190px]">
                      <p className="mb-1 text-[11px] font-medium text-zinc-500">Slide size</p>
                      <Slider
                        value={[thumbnailSize]}
                        min={150}
                        max={320}
                        step={10}
                        onValueChange={(value) => setThumbnailSize(value[0] ?? 220)}
                      />
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-500">
                      {filteredSlides.length} available
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-zinc-50/50 p-4">
                {filteredSlides.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
                    No slides match the current filters.
                  </div>
                ) : galleryMode === "grid" ? (
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}
                  >
                    {filteredSlides.map((slide) => (
                      <div key={slide.slide_number} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#c4a052]/40 hover:shadow-md">
                        <button type="button" onClick={() => setPreviewSlide(slide)} className="block w-full text-left">
                          <SlidePreviewImage slide={slide} className="aspect-[4/3] w-full" />
                        </button>
                        <div className="space-y-3 p-4">
                          <div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                              <span className="font-mono">#{slide.slide_number}</span>
                              <span>{statusLabel(slide.slide_type || "slide")}</span>
                              {slide.is_celebrity_case && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">Celebrity</span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">{getSlideTitle(slide)}</p>
                            {slide.solution && slide.solution !== slide.condition && (
                              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{slide.solution}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {slide.treatments.slice(0, 3).map((t) => (
                              <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600">
                                {statusLabel(t)}
                              </span>
                            ))}
                            {slide.concerns.slice(0, 2).map((c) => (
                              <span key={c} className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] text-purple-600">
                                {statusLabel(c)}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewSlide(slide)}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => addToDeck(slide)}
                              className="rounded-lg bg-[#c4a052] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#b8933f]"
                            >
                              Add to Deck
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full gap-4 overflow-x-auto pb-2">
                    {filteredSlides.map((slide) => (
                      <div key={slide.slide_number} className="flex w-[min(340px,75vw)] shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <button type="button" onClick={() => setPreviewSlide(slide)} className="block w-full text-left">
                          <SlidePreviewImage slide={slide} className="aspect-[4/3] w-full" />
                        </button>
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span className="font-mono">#{slide.slide_number}</span>
                            <span>{statusLabel(slide.slide_type || "slide")}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">{getSlideTitle(slide)}</p>
                          <p className="mt-1 line-clamp-3 text-xs text-zinc-500">{slide.solution || "Open to preview and inspect this case in detail."}</p>
                          <div className="mt-auto flex items-center justify-between pt-4">
                            <button
                              type="button"
                              onClick={() => setPreviewSlide(slide)}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => addToDeck(slide)}
                              className="rounded-lg bg-[#c4a052] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#b8933f]"
                            >
                              Add to Deck
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="hidden lg:flex" />

          <ResizablePanel defaultSize={32} minSize={24} className="hidden lg:block">
            <DeckBuilderPanel
              request={request}
              deckSlides={deckSlides}
              existingDeckId={existingDeckId}
              saving={saving}
              saveDeck={saveDeck}
              moveSlide={moveSlide}
              removeFromDeck={removeFromDeck}
              setPreviewSlide={setPreviewSlide}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              recommendations={recommendations}
              setRecommendations={setRecommendations}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
        <SheetContent side="right" className="w-full border-l sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Deck Builder</SheetTitle>
            <SheetDescription>
              Keep your selected slides in order while browsing the library.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DeckBuilderPanel
              request={request}
              deckSlides={deckSlides}
              existingDeckId={existingDeckId}
              saving={saving}
              saveDeck={saveDeck}
              moveSlide={moveSlide}
              removeFromDeck={removeFromDeck}
              setPreviewSlide={setPreviewSlide}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              recommendations={recommendations}
              setRecommendations={setRecommendations}
            />
          </div>
        </SheetContent>
      </Sheet>

      {previewSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewSlide(null)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">Slide Preview</p>
                <h3 className="text-xl font-bold text-zinc-900">Slide #{previewSlide.slide_number}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addToDeck(previewSlide)}
                  className="rounded-lg bg-[#c4a052] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#b8933f]"
                >
                  Add to Deck
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSlide(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
              <div>
                {previewSlide.full_slide_image ? (
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                    <img
                      src={slideImageUrl(previewSlide.full_slide_image)}
                      alt={`Slide ${previewSlide.slide_number} full render`}
                      className="w-full object-contain"
                    />
                  </div>
                ) : (
                  <SlidePreviewImage slide={previewSlide} className="aspect-[4/3] w-full rounded-2xl border border-zinc-200" />
                )}

                {previewSlide.images.length > 1 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {previewSlide.images.map((img, i) => (
                      <div key={`${img}-${i}`} className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                        <img src={slideImageUrl(img)} alt={`Slide ${previewSlide.slide_number} image ${i + 1}`} className="h-48 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Primary title</p>
                  <p className="mt-1 text-base font-semibold text-zinc-900">{getSlideTitle(previewSlide)}</p>
                </div>

                {previewSlide.solution && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Solution</p>
                    <p className="mt-1 text-sm text-zinc-700">{previewSlide.solution}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Type</p>
                    <p className="mt-1 text-zinc-700">{statusLabel(previewSlide.slide_type || "slide")}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Images</p>
                    <p className="mt-1 text-zinc-700">{previewSlide.image_count}</p>
                  </div>
                  {previewSlide.complexity !== null && (
                    <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Complexity</p>
                      <p className="mt-1 text-zinc-700">{previewSlide.complexity}/10</p>
                    </div>
                  )}
                  {previewSlide.cost_numeric && (
                    <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Cost</p>
                      <p className="mt-1 text-zinc-700">${previewSlide.cost_numeric.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Treatments</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewSlide.treatments.length ? previewSlide.treatments.map((t) => (
                      <span key={t} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-600">
                        {statusLabel(t)}
                      </span>
                    )) : <span className="text-sm text-zinc-400">None listed</span>}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Concerns</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewSlide.concerns.length ? previewSlide.concerns.map((c) => (
                      <span key={c} className="rounded-full bg-purple-50 px-2 py-1 text-[11px] text-purple-600">
                        {statusLabel(c)}
                      </span>
                    )) : <span className="text-sm text-zinc-400">None listed</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
