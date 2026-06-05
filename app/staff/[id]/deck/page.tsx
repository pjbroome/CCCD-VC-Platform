"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  deleteSlide,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck } from "@/lib/api"
import { Slider } from "@/components/ui/slider"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/* ── helpers ─────────────────────────────────────────────── */

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

type RecommendationPreset = {
  id: string
  treatment: string
  visits: string
  investment: string
  enabled: boolean
}

const DEFAULT_RECOMMENDATIONS: RecommendationPreset[] = [
  { id: "npe", treatment: "New Patient Evaluation (NPE)", visits: "1 visit · reserve 1.5 hrs", investment: "$500", enabled: true },
  { id: "bleaching", treatment: "Bleaching", visits: "1 visit", investment: "$450 to $650", enabled: true },
  { id: "icon", treatment: "Icon / Remineralization", visits: "1 visit", investment: "Case dependent", enabled: true },
  { id: "invisalign", treatment: "Invisalign", visits: "3 avg visits", investment: "$7,500 to $9,500", enabled: true },
  { id: "smile-project", treatment: "Smile Project", visits: "3 visits", investment: "$12k to $35k", enabled: true },
  { id: "rescue", treatment: "Rescue / Complex Implant Prosthetic Project", visits: "Case dependent", investment: "$65k to $145k+", enabled: true },
]

/* ── summary-slide dropdown option lists (built & edited by the doctor, persisted) ── */

const SUMMARY_OPTIONS_KEY = "vc-summary-options"
type SummaryOptions = { treatments: string[]; visits: string[]; fees: string[] }
const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  treatments: DEFAULT_RECOMMENDATIONS.map((r) => r.treatment),
  visits: Array.from(new Set(DEFAULT_RECOMMENDATIONS.map((r) => r.visits))),
  fees: Array.from(new Set(DEFAULT_RECOMMENDATIONS.map((r) => r.investment))),
}

function readSummaryOptions(): SummaryOptions {
  if (typeof window === "undefined") return DEFAULT_SUMMARY_OPTIONS
  try {
    const raw = window.localStorage.getItem(SUMMARY_OPTIONS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { treatments: p.treatments || [], visits: p.visits || [], fees: p.fees || [] }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SUMMARY_OPTIONS
}

function EditableSelect({ value, options, placeholder, onChange, onAddOption }: { value: string; options: string[]; placeholder: string; onChange: (v: string) => void; onAddOption: (v: string) => void }) {
  const all = Array.from(new Set([...options, value].filter(Boolean)))
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__add__") {
          const v = typeof window !== "undefined" ? window.prompt(`Add a new ${placeholder.toLowerCase()}`) : null
          if (v && v.trim()) {
            onAddOption(v.trim())
            onChange(v.trim())
          }
        } else {
          onChange(e.target.value)
        }
      }}
      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 focus:border-[#c4a052] focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {all.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value="__add__">＋ Add new…</option>
    </select>
  )
}

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
    JSON.stringify({ slide_numbers: slideNumbers, recommendation_items: recommendationItems, updated_at: new Date().toISOString() } satisfies DraftDeckState)
  )
}

function clearDraftDeck(requestId: number) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(draftDeckStorageKey(requestId))
}

function resolveDeckSlides(slideNumbers: number[], slideMap: Map<number, SlideItem>) {
  return slideNumbers.map((n) => slideMap.get(n)).filter(Boolean) as SlideItem[]
}

/* ── slide image ─────────────────────────────────────────── */

function SlideImg({ slide, className }: { slide: SlideItem; className: string }) {
  const primary = slide.full_slide_image || slide.images[0]
  if (!primary) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 text-xs font-mono text-zinc-400 ${className}`}>
        #{slide.slide_number}
      </div>
    )
  }
  return (
    <div className={`overflow-hidden bg-zinc-100 ${className}`}>
      <img
        src={slideImageUrl(primary)}
        alt={`Slide ${slide.slide_number}`}
        draggable={false}
        className="h-full w-full select-none object-cover"
        onError={(e) => {
          const t = e.target as HTMLImageElement
          t.style.display = "none"
          if (t.parentElement) t.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-xs font-mono text-zinc-400">#${slide.slide_number}</div>`
        }}
      />
    </div>
  )
}

/* ── dock (tray) item — sortable ─────────────────────────── */

function DockItem({ slide, index, onRemove, onPreview }: { slide: SlideItem; index: number; onRemove: () => void; onPreview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `D:${slide.slide_number}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="group relative flex w-[132px] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-[#c4a052] text-[11px] font-bold text-white shadow">{index + 1}</div>
      <button
        type="button"
        onClick={onRemove}
        title="Remove from deck"
        className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow transition hover:bg-red-500 hover:text-white"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" onClick={onPreview} title="Drag to reorder · click to preview">
        <SlideImg slide={slide} className="aspect-[4/3] w-full" />
      </button>
      <p className="truncate px-2 py-1.5 text-[10px] font-medium text-zinc-500">{getSlideTitle(slide)}</p>
    </div>
  )
}

/* ── dock drop zone ──────────────────────────────────────── */

function DockZone({ deck, onRemove, onPreview }: { deck: SlideItem[]; onRemove: (n: number) => void; onPreview: (s: SlideItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "DOCK" })
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[150px] items-stretch gap-3 overflow-x-auto rounded-2xl border-2 border-dashed p-3 transition-colors ${
        isOver ? "border-[#c4a052] bg-amber-50/60" : "border-zinc-200 bg-zinc-50/60"
      }`}
    >
      {deck.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-1 py-6 text-center">
          <svg className="size-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m-6 3.75 3 3m0 0 3-3m-3 3V1.5" /></svg>
          <p className="text-xs font-medium text-zinc-500">Drag slides up here to build the deck</p>
          <p className="text-[11px] text-zinc-400">They copy from the library — drag to reorder, × to remove.</p>
        </div>
      ) : (
        <SortableContext items={deck.map((s) => `D:${s.slide_number}`)} strategy={horizontalListSortingStrategy}>
          {deck.map((slide, idx) => (
            <DockItem key={slide.slide_number} slide={slide} index={idx} onRemove={() => onRemove(slide.slide_number)} onPreview={() => onPreview(slide)} />
          ))}
        </SortableContext>
      )}
    </div>
  )
}

/* ── library card — draggable into the dock ──────────────── */

function LibraryCard({ slide, size, inDeck, onAdd, onPreview, onDelete }: { slide: SlideItem; size: number; inDeck: boolean; onAdd: () => void; onPreview: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `L:${slide.slide_number}` })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : undefined }
  return (
    <div ref={setNodeRef} style={style} className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${inDeck ? "border-[#c4a052]/60 ring-1 ring-[#c4a052]/30" : "border-zinc-200 hover:-translate-y-0.5 hover:shadow-md"}`}>
      {inDeck && <div className="absolute left-2 top-2 z-10 rounded-full bg-[#c4a052] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">In deck</div>}
      <button
        type="button"
        onClick={onDelete}
        title="Delete from library"
        className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/85 text-zinc-400 opacity-0 shadow transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
      </button>
      <button type="button" {...attributes} {...listeners} onClick={onPreview} className="block cursor-grab text-left active:cursor-grabbing" title="Drag up to add · click to preview">
        <SlideImg slide={slide} className="aspect-[4/3] w-full" />
      </button>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-zinc-600" title={getSlideTitle(slide)}>{getSlideTitle(slide)}</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={inDeck}
          className="shrink-0 rounded-lg bg-[#c4a052] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#b8933f] disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {inDeck ? "Added" : "Add"}
        </button>
      </div>
    </div>
  )
}

/* ── page ────────────────────────────────────────────────── */

export default function DeckBuilderPage() {
  const params = useParams()
  const requestId = Number(params.id)

  const [request, setRequest] = useState<VCRequestListItem | null>(null)
  const [allSlides, setAllSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchText, setSearchText] = useState("")
  const [thumbnailSize, setThumbnailSize] = useState(190)

  const [deckSlides, setDeckSlides] = useState<SlideItem[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationPreset[]>(DEFAULT_RECOMMENDATIONS)
  const [summaryOptions, setSummaryOptions] = useState<SummaryOptions>(DEFAULT_SUMMARY_OPTIONS)
  const [existingDeckId, setExistingDeckId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [previewSlide, setPreviewSlide] = useState<SlideItem | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const initialized = useMemo(() => ({ done: false }), [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  /* load */
  useEffect(() => {
    async function load() {
      try {
        const [reqData, slideData, deckData] = await Promise.all([getVCRequest(requestId), listAllSlides(), listRecordingDecks()])
        setRequest(reqData)
        setAllSlides(slideData.slides)
        const slideMap = new Map(slideData.slides.map((s: SlideItem) => [s.slide_number, s]))
        const existingDeck = reqData.deck_id ? deckData.decks.find((d: RecordingDeck) => d.id === reqData.deck_id) ?? null : null
        setExistingDeckId(existingDeck?.id ?? null)
        if (reqData.status === "sent") clearDraftDeck(requestId)
        const draftDeck = reqData.status === "sent" ? null : readDraftDeck(requestId)
        if (draftDeck?.recommendation_items?.length) setRecommendations(draftDeck.recommendation_items)
        if (draftDeck?.slide_numbers?.length) {
          setDeckSlides(resolveDeckSlides(draftDeck.slide_numbers, slideMap))
          setSaveMsg("Loaded your in-progress deck draft.")
        } else if (existingDeck) {
          setDeckSlides(resolveDeckSlides(existingDeck.slide_numbers, slideMap))
        }
        initialized.done = true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    if (requestId && !isNaN(requestId)) load()
  }, [requestId, initialized])

  /* persist draft */
  useEffect(() => {
    if (!initialized.done || !requestId || Number.isNaN(requestId)) return
    if (request?.status === "sent") { clearDraftDeck(requestId); return }
    if (deckSlides.length > 0 || recommendations.length > 0) {
      writeDraftDeck(requestId, deckSlides.map((s) => s.slide_number), recommendations)
    } else {
      clearDraftDeck(requestId)
    }
  }, [requestId, request?.status, deckSlides, recommendations, initialized])

  /* summary dropdown option lists — load once, persist on change */
  useEffect(() => { setSummaryOptions(readSummaryOptions()) }, [])
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SUMMARY_OPTIONS_KEY, JSON.stringify(summaryOptions))
  }, [summaryOptions])
  const addSummaryOption = useCallback((field: keyof SummaryOptions, val: string) => {
    setSummaryOptions((p) => (p[field].includes(val) ? p : { ...p, [field]: [...p[field], val] }))
  }, [])
  const removeSummaryOption = useCallback((field: keyof SummaryOptions, val: string) => {
    setSummaryOptions((p) => ({ ...p, [field]: p[field].filter((o) => o !== val) }))
  }, [])

  const deckNumbers = useMemo(() => new Set(deckSlides.map((s) => s.slide_number)), [deckSlides])

  const filteredSlides = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return allSlides
    return allSlides.filter((s) =>
      [s.condition, s.solution, String(s.slide_number), s.slide_type, ...(s.text_content || [])].join(" ").toLowerCase().includes(q)
    )
  }, [allSlides, searchText])

  const addToDeck = useCallback((slide: SlideItem) => {
    setDeckSlides((prev) => (prev.some((d) => d.slide_number === slide.slide_number) ? prev : [...prev, slide]))
    setSaveMsg(null)
  }, [])

  const removeFromDeck = useCallback((slideNumber: number) => {
    setDeckSlides((prev) => prev.filter((s) => s.slide_number !== slideNumber))
    setSaveMsg(null)
  }, [])

  const handleDeleteFromLibrary = useCallback(async (slide: SlideItem) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${getSlideTitle(slide)}" from the library? This removes the image for good.`)) return
    setAllSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    setDeckSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    try {
      await deleteSlide(slide.slide_number)
    } catch {
      /* keep the optimistic removal; a stale entry will 404 on image load anyway */
    }
  }, [])

  /* drag */
  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const a = String(active.id)
    const o = String(over.id)
    if (a.startsWith("L:")) {
      const sn = Number(a.slice(2))
      if (deckNumbers.has(sn)) return
      if (o === "DOCK" || o.startsWith("D:")) {
        const slide = allSlides.find((s) => s.slide_number === sn)
        if (!slide) return
        setDeckSlides((prev) => {
          let idx = prev.length
          if (o.startsWith("D:")) {
            const oi = prev.findIndex((d) => `D:${d.slide_number}` === o)
            if (oi >= 0) idx = oi
          }
          const copy = [...prev]
          copy.splice(idx, 0, slide)
          return copy
        })
        setSaveMsg(null)
      }
    } else if (a.startsWith("D:") && o.startsWith("D:") && a !== o) {
      setDeckSlides((prev) => {
        const from = prev.findIndex((d) => `D:${d.slide_number}` === a)
        const to = prev.findIndex((d) => `D:${d.slide_number}` === o)
        if (from < 0 || to < 0) return prev
        return arrayMove(prev, from, to)
      })
      setSaveMsg(null)
    }
  }

  const activeSlide = useMemo(() => {
    if (!activeId) return null
    const sn = Number(activeId.slice(2))
    return allSlides.find((s) => s.slide_number === sn) ?? null
  }, [activeId, allSlides])

  const saveDeck = useCallback(async () => {
    if (!request || deckSlides.length === 0) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const name = `Request #${request.id} — ${getDisplayName(request)}`
      const slideNumbers = deckSlides.map((s) => s.slide_number)
      if (existingDeckId) {
        try { await deleteRecordingDeck(existingDeckId) } catch { /* ignore */ }
      }
      const newDeck = await createRecordingDeck(name, slideNumbers)
      setExistingDeckId(newDeck.id)
      await updateVCRequest(request.id, { deck_id: newDeck.id })
      setRequest((prev) => (prev ? { ...prev, deck_id: newDeck.id } : prev))
      writeDraftDeck(request.id, slideNumbers, recommendations)
      setSaveMsg(`Saved deck #${newDeck.id} (${slideNumbers.length} slides).`)
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
          <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-sm">Loading deck builder…</span>
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4">
        <p className="text-sm font-medium text-red-600">{error || "Request not found"}</p>
        <Link href="/staff" className="mt-4 text-sm text-[#c4a052] underline">Back to Dashboard</Link>
      </div>
    )
  }

  const enabledRecs = recommendations.filter((r) => r.enabled).length

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex min-h-dvh flex-col bg-zinc-50">
        {/* header */}
        <header className="z-30 border-b border-zinc-200 bg-white">
          <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={`/staff/${request.id}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                Profile
              </Link>
              <span className="text-zinc-200">/</span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">Doctor Workspace</p>
                <p className="truncate text-sm font-bold text-zinc-900">#{request.id} — {getDisplayName(request)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSummaryOpen(true)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                Summary slide <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{enabledRecs}</span>
              </button>
              {deckSlides.length > 0 && (
                <Link href={`/staff/${request.id}/deck/present`} className="hidden items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-700 sm:flex">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                  Present
                </Link>
              )}
              <button onClick={saveDeck} disabled={saving || deckSlides.length === 0} className="rounded-lg bg-[#c4a052] px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#b8933f] disabled:opacity-40" type="button">
                {saving ? "Saving…" : "Save Deck"}
              </button>
            </div>
          </div>
          {saveMsg && <div className={`border-t px-4 py-2 text-xs font-medium ${saveMsg.startsWith("Save failed") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{saveMsg}</div>}
        </header>

        {/* DOCK / TRAY */}
        <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">Patient Deck <span className="text-zinc-400">({deckSlides.length})</span></h2>
            {deckSlides.length > 0 && (
              <button type="button" onClick={() => setDeckSlides([])} className="text-[11px] font-medium text-zinc-400 hover:text-red-500">Clear all</button>
            )}
          </div>
          <DockZone deck={deckSlides} onRemove={removeFromDeck} onPreview={setPreviewSlide} />
        </div>

        {/* LIBRARY */}
        <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Slide Library</h2>
              <p className="mt-1 text-xs text-zinc-500">Drag a slide up into the deck (it copies — the library keeps it), or tap Add. Hover to delete.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search slides…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-300 focus:border-[#c4a052] focus:outline-none focus:ring-1 focus:ring-[#c4a052]/30 sm:w-64"
              />
              <div className="min-w-[150px]">
                <p className="mb-1 text-[11px] font-medium text-zinc-500">Size</p>
                <Slider value={[thumbnailSize]} min={140} max={300} step={10} onValueChange={(v) => setThumbnailSize(v[0] ?? 190)} />
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-500">{filteredSlides.length} slides</span>
            </div>
          </div>

          {filteredSlides.length === 0 ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400">No slides match “{searchText}”.</div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>
              {filteredSlides.map((slide) => (
                <LibraryCard
                  key={slide.slide_number}
                  slide={slide}
                  size={thumbnailSize}
                  inDeck={deckNumbers.has(slide.slide_number)}
                  onAdd={() => addToDeck(slide)}
                  onPreview={() => setPreviewSlide(slide)}
                  onDelete={() => handleDeleteFromLibrary(slide)}
                />
              ))}
            </div>
          )}
        </div>

        {/* drag overlay */}
        <DragOverlay>
          {activeSlide ? (
            <div className="w-[150px] overflow-hidden rounded-xl border-2 border-[#c4a052] bg-white shadow-2xl">
              <SlideImg slide={activeSlide} className="aspect-[4/3] w-full" />
            </div>
          ) : null}
        </DragOverlay>

        {/* summary slide editor */}
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Final summary slide</SheetTitle>
              <SheetDescription>Treatment options, visits, and ballpark fees shown on the last slide. Toggle, edit, add, or remove rows.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {recommendations.map((item, idx) => (
                <div key={item.id} className="rounded-xl border border-amber-200/70 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-zinc-800">
                      <input type="checkbox" checked={item.enabled} onChange={(e) => setRecommendations((p) => p.map((r, i) => (i === idx ? { ...r, enabled: e.target.checked } : r)))} className="size-4 rounded border-zinc-300 text-[#c4a052] focus:ring-[#c4a052]" />
                      Show on final slide
                    </label>
                    <button type="button" onClick={() => setRecommendations((p) => p.filter((r) => r.id !== item.id))} className="rounded-md px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50">Remove</button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <EditableSelect value={item.treatment} options={summaryOptions.treatments} placeholder="Treatment option" onChange={(v) => setRecommendations((p) => p.map((r, i) => (i === idx ? { ...r, treatment: v } : r)))} onAddOption={(v) => addSummaryOption("treatments", v)} />
                    <EditableSelect value={item.visits} options={summaryOptions.visits} placeholder="# of visits" onChange={(v) => setRecommendations((p) => p.map((r, i) => (i === idx ? { ...r, visits: v } : r)))} onAddOption={(v) => addSummaryOption("visits", v)} />
                    <EditableSelect value={item.investment} options={summaryOptions.fees} placeholder="Ballpark fee" onChange={(v) => setRecommendations((p) => p.map((r, i) => (i === idx ? { ...r, investment: v } : r)))} onAddOption={(v) => addSummaryOption("fees", v)} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setRecommendations((p) => [...p, { id: `custom-${Date.now()}`, treatment: "", visits: "", investment: "", enabled: true }])} className="w-full rounded-lg border border-dashed border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">+ Add row</button>

              <details className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-700">Manage dropdown options</summary>
                <p className="mt-1 text-[11px] text-zinc-400">These build the dropdowns above. Add new ones from any dropdown’s “＋ Add new…”.</p>
                <div className="mt-3 space-y-3">
                  {([["treatments", "Treatments"], ["visits", "Visits"], ["fees", "Fees"]] as [keyof SummaryOptions, string][]).map(([field, label]) => (
                    <div key={field}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {summaryOptions[field].length === 0 && <span className="text-[11px] text-zinc-400">None yet</span>}
                        {summaryOptions[field].map((o) => (
                          <span key={o} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200">
                            {o}
                            <button type="button" onClick={() => removeSummaryOption(field, o)} className="text-zinc-400 hover:text-red-500" title="Remove option">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </SheetContent>
        </Sheet>

        {/* preview modal */}
        {previewSlide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewSlide(null)}>
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">Slide Preview</p>
                  <h3 className="text-xl font-bold text-zinc-900">{getSlideTitle(previewSlide)}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {!deckNumbers.has(previewSlide.slide_number) && (
                    <button type="button" onClick={() => { addToDeck(previewSlide); setPreviewSlide(null) }} className="rounded-lg bg-[#c4a052] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#b8933f]">Add to Deck</button>
                  )}
                  <button type="button" onClick={() => setPreviewSlide(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                <img src={slideImageUrl(previewSlide.full_slide_image || previewSlide.images[0] || "")} alt={`Slide ${previewSlide.slide_number}`} className="max-h-[70vh] w-full object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
