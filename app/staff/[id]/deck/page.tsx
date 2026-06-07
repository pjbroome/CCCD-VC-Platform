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
  deleteSlide,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck } from "@/lib/api"
import { Slider } from "@/components/ui/slider"
import { StaffNav } from "@/components/vc/StaffNav"
import { StaffStepNav } from "@/components/vc/StaffStepNav"
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
import { SortableContext, horizontalListSortingStrategy, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/* ── helpers ─────────────────────────────────────────────── */

function getDisplayName(r: VCRequestListItem) {
  if (r.first_name && r.last_name) return `${r.first_name} ${r.last_name}`
  if (r.patient_name) return r.patient_name
  return "Unknown"
}

function getSlideTitle(slide: SlideItem) {
  return slide.condition || slide.solution || `Slide ${slide.slide_number}`
}

/* ── treatment presets (go-to suggestions) — editable, persisted ── */

type TxPreset = { id: string; name: string; visits: string; fee: string }
const TX_PRESETS_KEY = "vc-tx-presets"
const DEFAULT_TX_PRESETS: TxPreset[] = [
  { id: "smile", name: "Smile Project", visits: "3 visits", fee: "$15k–$35k" },
  { id: "invisalign", name: "Invisalign", visits: "3–4 visits", fee: "$4,500–$9,500" },
  { id: "npe", name: "New Patient Evaluation (NPE)", visits: "1 visit · reserve 1.5 hrs", fee: "$500" },
  { id: "bleaching", name: "Bleaching", visits: "1 visit", fee: "$450–$650" },
  { id: "icon", name: "Icon / Remineralization", visits: "1 visit", fee: "Case dependent" },
  { id: "veneers", name: "No-Prep Veneers", visits: "2–3 visits", fee: "Case dependent" },
  { id: "rescue", name: "Rescue / Complex Implant Project", visits: "Case dependent", fee: "$65k–$145k+" },
]

function readTxPresets(): TxPreset[] {
  if (typeof window === "undefined") return DEFAULT_TX_PRESETS
  try {
    const raw = window.localStorage.getItem(TX_PRESETS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (Array.isArray(p) && p.length) return p
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_TX_PRESETS
}

/* selected summary rows for THIS patient (kept enabled-shaped for the presenter) */
type SummaryRow = { id: string; treatment: string; visits: string; investment: string; enabled: boolean }

type DraftDeckState = { slide_numbers: number[]; recommendation_items?: SummaryRow[]; updated_at: string }
const draftKey = (id: number) => `vc-draft-deck:${id}`

function readDraftDeck(id: number): DraftDeckState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(draftKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftDeckState
    if (!Array.isArray(parsed.slide_numbers)) return null
    return parsed
  } catch {
    return null
  }
}
function writeDraftDeck(id: number, slideNumbers: number[], rows: SummaryRow[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(draftKey(id), JSON.stringify({ slide_numbers: slideNumbers, recommendation_items: rows, updated_at: new Date().toISOString() }))
}
function clearDraftDeck(id: number) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(draftKey(id))
}
function resolveDeckSlides(slideNumbers: number[], map: Map<number, SlideItem>) {
  return slideNumbers.map((n) => map.get(n)).filter(Boolean) as SlideItem[]
}

const FAV_KEY = "vc-fav-slides"
function readFavs(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(FAV_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}

const LIB_ORDER_KEY = "vc-lib-order"
function readLibOrder(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(LIB_ORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}

/* ── slide image ─────────────────────────────────────────── */

function SlideImg({ slide, className }: { slide: SlideItem; className: string }) {
  const primary = slide.full_slide_image || slide.images[0]
  if (!primary) {
    return <div className={`flex items-center justify-center bg-zinc-100 text-xs font-mono text-zinc-400 ${className}`}>#{slide.slide_number}</div>
  }
  return (
    <div className={`overflow-hidden bg-zinc-100 ${className}`}>
      <img src={slideImageUrl(primary)} alt={`Slide ${slide.slide_number}`} draggable={false} className="h-full w-full select-none object-cover" />
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.05 4.15 4.58.67-3.31 3.23.78 4.56-4.1-2.15-4.1 2.15.78-4.56-3.31-3.23 4.58-.67 2.05-4.15z" />
    </svg>
  )
}

/* ── dock (tray) item — sortable ─────────────────────────── */

function DockItem({ slide, index, onRemove, onPreview }: { slide: SlideItem; index: number; onRemove: () => void; onPreview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `D:${slide.slide_number}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="group relative flex w-[128px] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-[var(--k-accent)] text-[11px] font-bold text-white shadow">{index + 1}</div>
      <button type="button" onClick={onRemove} title="Remove from deck" className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow transition hover:bg-red-500 hover:text-white">
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" onClick={onPreview} title="Drag to reorder · click to preview">
        <SlideImg slide={slide} className="aspect-[4/3] w-full" />
      </button>
      <p className="truncate px-2 py-1.5 text-[10px] font-medium text-zinc-500">{getSlideTitle(slide)}</p>
    </div>
  )
}

function DockZone({ deck, onRemove, onPreview }: { deck: SlideItem[]; onRemove: (n: number) => void; onPreview: (s: SlideItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "DOCK" })
  return (
    <div ref={setNodeRef} className={`flex min-h-[148px] items-stretch gap-3 overflow-x-auto rounded-2xl border-2 border-dashed p-3 transition-colors ${isOver ? "border-[var(--k-accent)] bg-amber-50/60" : "border-zinc-200 bg-zinc-50/60"}`}>
      {deck.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-1 py-5 text-center">
          <p className="text-xs font-medium text-zinc-500">Double-click or drag slides here to build the presentation</p>
          <p className="text-[11px] text-zinc-400">They play in this order on the record screen — drag to reorder, × to remove.</p>
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

/* ── library card — draggable, double-click to add, star to favorite ── */

function LibraryCard({ slide, inDeck, fav, onAdd, onPreview, onDelete, onToggleFav }: { slide: SlideItem; inDeck: boolean; fav: boolean; onAdd: () => void; onPreview: () => void; onDelete: () => void; onToggleFav: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `L:${slide.slide_number}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : undefined }
  return (
    <div ref={setNodeRef} style={style} onDoubleClick={onAdd} className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${inDeck ? "border-[#f97316]/70 ring-1 ring-[#f97316]/40" : "border-zinc-200 hover:-translate-y-0.5 hover:shadow-md"}`}>
      <div className="absolute left-2 top-2 z-10 flex gap-1">
        <button type="button" onClick={onToggleFav} title={fav ? "Unpin from Most Used" : "Pin to Most Used"} className={`flex size-7 items-center justify-center rounded-full shadow transition ${fav ? "bg-[var(--k-accent)] text-white" : "bg-white/85 text-zinc-400 hover:text-[var(--k-accent)]"}`}>
          <StarIcon filled={fav} />
        </button>
        {inDeck && <span title="In deck" className="size-2.5 rounded-full bg-[#f97316] shadow ring-2 ring-white" />}
      </div>
      <button type="button" onClick={onDelete} title="Delete from library" className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/85 text-zinc-400 opacity-0 shadow transition hover:bg-red-500 hover:text-white group-hover:opacity-100">
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
      </button>
      <button type="button" {...attributes} {...listeners} onClick={onPreview} className="block cursor-grab text-left active:cursor-grabbing" title="Double-click to add · drag up · click to preview">
        <SlideImg slide={slide} className="aspect-[4/3] w-full" />
      </button>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-zinc-600" title={getSlideTitle(slide)}>{getSlideTitle(slide)}</p>
        <button type="button" onClick={onAdd} disabled={inDeck} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400">{inDeck ? "Added" : "Add"}</button>
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
  const [thumbnailSize, setThumbnailSize] = useState(200)

  const [deckSlides, setDeckSlides] = useState<SlideItem[]>([])
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [txPresets, setTxPresets] = useState<TxPreset[]>(DEFAULT_TX_PRESETS)
  const [favs, setFavs] = useState<number[]>([])
  const [libOrder, setLibOrder] = useState<number[]>([])
  const [existingDeckId, setExistingDeckId] = useState<number | null>(null)
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const lastSavedRef = useRef<string>("")

  const [previewSlide, setPreviewSlide] = useState<SlideItem | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [managePresets, setManagePresets] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const initialized = useMemo(() => ({ done: false }), [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    async function load() {
      try {
        const [reqData, slideData, deckData] = await Promise.all([getVCRequest(requestId), listAllSlides(), listRecordingDecks()])
        setRequest(reqData)
        setAllSlides(slideData.slides)
        setTxPresets(readTxPresets())
        setFavs(readFavs())
        const allNums = slideData.slides.map((s: SlideItem) => s.slide_number)
        const storedOrder = readLibOrder()
        setLibOrder([...storedOrder.filter((n) => allNums.includes(n)), ...allNums.filter((n) => !storedOrder.includes(n))])
        const map = new Map(slideData.slides.map((s: SlideItem) => [s.slide_number, s]))
        const existingDeck = reqData.deck_id ? deckData.decks.find((d: RecordingDeck) => d.id === reqData.deck_id) ?? null : null
        setExistingDeckId(existingDeck?.id ?? null)
        lastSavedRef.current = existingDeck ? existingDeck.slide_numbers.join(",") : ""
        if (reqData.status === "sent") clearDraftDeck(requestId)
        const draft = reqData.status === "sent" ? null : readDraftDeck(requestId)
        if (draft?.recommendation_items?.length) setSummaryRows(draft.recommendation_items)
        if (draft?.slide_numbers?.length) {
          setDeckSlides(resolveDeckSlides(draft.slide_numbers, map))
          setSaveMsg("Loaded your in-progress deck draft.")
        } else if (existingDeck) {
          setDeckSlides(resolveDeckSlides(existingDeck.slide_numbers, map))
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

  useEffect(() => {
    if (!initialized.done || !requestId || Number.isNaN(requestId)) return
    if (request?.status === "sent") { clearDraftDeck(requestId); return }
    if (deckSlides.length > 0 || summaryRows.length > 0) writeDraftDeck(requestId, deckSlides.map((s) => s.slide_number), summaryRows)
    else clearDraftDeck(requestId)
  }, [requestId, request?.status, deckSlides, summaryRows, initialized])

  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(TX_PRESETS_KEY, JSON.stringify(txPresets)) }, [txPresets])
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(FAV_KEY, JSON.stringify(favs)) }, [favs])
  useEffect(() => { if (typeof window !== "undefined" && libOrder.length) window.localStorage.setItem(LIB_ORDER_KEY, JSON.stringify(libOrder)) }, [libOrder])

  const deckNumbers = useMemo(() => new Set(deckSlides.map((s) => s.slide_number)), [deckSlides])
  const favSet = useMemo(() => new Set(favs), [favs])

  const orderedSlides = useMemo(() => {
    if (!libOrder.length) return allSlides
    const idx = new Map(libOrder.map((n, i) => [n, i]))
    return [...allSlides].sort((a, b) => (idx.get(a.slide_number) ?? 1e9) - (idx.get(b.slide_number) ?? 1e9))
  }, [allSlides, libOrder])
  const filteredSlides = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return q ? orderedSlides.filter((s) => [s.condition, s.solution, String(s.slide_number), ...(s.text_content || [])].join(" ").toLowerCase().includes(q)) : orderedSlides
  }, [orderedSlides, searchText])

  const favSlides = useMemo(() => favs.map((n) => allSlides.find((s) => s.slide_number === n)).filter(Boolean) as SlideItem[], [favs, allSlides])

  const addToDeck = useCallback((slide: SlideItem) => {
    setDeckSlides((prev) => (prev.some((d) => d.slide_number === slide.slide_number) ? prev : [...prev, slide]))
    setSaveMsg(null)
  }, [])
  const removeFromDeck = useCallback((n: number) => { setDeckSlides((prev) => prev.filter((s) => s.slide_number !== n)); setSaveMsg(null) }, [])
  const toggleFav = useCallback((n: number) => setFavs((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [n, ...prev])), [])

  const handleDelete = useCallback(async (slide: SlideItem) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${getSlideTitle(slide)}" from the library? This removes the image for good.`)) return
    setAllSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    setDeckSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    setFavs((prev) => prev.filter((x) => x !== slide.slide_number))
    try { await deleteSlide(slide.slide_number) } catch { /* optimistic */ }
  }, [])

  /* summary rows */
  const addSummaryFromPreset = useCallback((presetId: string) => {
    const p = txPresets.find((x) => x.id === presetId)
    if (!p) return
    setSummaryRows((prev) => [...prev, { id: `row-${Date.now()}`, treatment: p.name, visits: p.visits, investment: p.fee, enabled: true }])
  }, [txPresets])
  const updateSummaryRow = useCallback((id: string, patch: Partial<SummaryRow>) => setSummaryRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))), [])
  const removeSummaryRow = useCallback((id: string) => setSummaryRows((prev) => prev.filter((r) => r.id !== id)), [])

  /* drag */
  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const a = String(active.id), o = String(over.id)
    if (a.startsWith("L:")) {
      const sn = Number(a.slice(2))
      if (o.startsWith("L:")) {
        const on = Number(o.slice(2))
        if (sn !== on) setLibOrder((prev) => { const f = prev.indexOf(sn), t = prev.indexOf(on); return f < 0 || t < 0 ? prev : arrayMove(prev, f, t) })
        return
      }
      if (deckNumbers.has(sn)) return
      if (o === "DOCK" || o.startsWith("D:")) {
        const slide = allSlides.find((s) => s.slide_number === sn)
        if (!slide) return
        setDeckSlides((prev) => {
          let idx = prev.length
          if (o.startsWith("D:")) { const oi = prev.findIndex((d) => `D:${d.slide_number}` === o); if (oi >= 0) idx = oi }
          const copy = [...prev]; copy.splice(idx, 0, slide); return copy
        })
        setSaveMsg(null)
      }
    } else if (a.startsWith("D:") && o.startsWith("D:") && a !== o) {
      setDeckSlides((prev) => {
        const from = prev.findIndex((d) => `D:${d.slide_number}` === a)
        const to = prev.findIndex((d) => `D:${d.slide_number}` === o)
        return from < 0 || to < 0 ? prev : arrayMove(prev, from, to)
      })
      setSaveMsg(null)
    }
  }
  const activeSlide = useMemo(() => (activeId ? allSlides.find((s) => s.slide_number === Number(activeId.slice(2))) ?? null : null), [activeId, allSlides])

  const saveDeck = useCallback(async () => {
    if (!request || deckSlides.length === 0) return
    setAutoSaveState("saving")
    setSaveMsg(null)
    try {
      const name = `Request #${request.id} — ${getDisplayName(request)}`
      const slideNumbers = deckSlides.map((s) => s.slide_number)
      if (existingDeckId) { try { await deleteRecordingDeck(existingDeckId) } catch { /* ignore */ } }
      const newDeck = await createRecordingDeck(name, slideNumbers)
      setExistingDeckId(newDeck.id)
      await updateVCRequest(request.id, { deck_id: newDeck.id })
      setRequest((prev) => (prev ? { ...prev, deck_id: newDeck.id } : prev))
      writeDraftDeck(request.id, slideNumbers, summaryRows)
      lastSavedRef.current = slideNumbers.join(",")
      setAutoSaveState("saved")
    } catch (err) {
      setAutoSaveState("error")
      setSaveMsg(`Auto-save failed: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }, [request, deckSlides, existingDeckId, summaryRows])

  /* Auto-save the deck (debounced) — no manual Save button needed. */
  useEffect(() => {
    if (!initialized.done || !requestId || Number.isNaN(requestId)) return
    if (request?.status === "sent") return
    if (deckSlides.length === 0) return
    const sig = deckSlides.map((s) => s.slide_number).join(",")
    if (sig === lastSavedRef.current) return
    setAutoSaveState("saving")
    const t = setTimeout(() => { saveDeck() }, 1200)
    return () => clearTimeout(t)
  }, [deckSlides, initialized, requestId, request?.status, saveDeck])

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-[var(--k-bg)]"><span className="text-sm text-zinc-400">Loading deck builder…</span></div>
  }
  if (error || !request) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--k-bg)] px-4">
        <p className="text-sm font-medium text-red-600">{error || "Request not found"}</p>
        <Link href="/staff" className="mt-4 text-sm text-[var(--k-accent)] underline">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex min-h-dvh flex-col bg-[var(--k-bg)]">
        <StaffNav
          current="deck"
          requestId={request.id}
          patientName={getDisplayName(request)}
          actions={
            <>
              <span className="hidden items-center gap-1.5 text-[11px] font-medium text-zinc-400 sm:flex">
                {autoSaveState === "saving" ? (
                  <><svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving…</>
                ) : autoSaveState === "error" ? (
                  <span className="text-red-500">Save failed</span>
                ) : autoSaveState === "saved" ? (
                  <><svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Saved</>
                ) : null}
              </span>
              {deckSlides.length > 0 && (
                <Link href={`/staff/${request.id}/deck/present`} className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 sm:flex">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                  Record
                </Link>
              )}
            </>
          }
        />
        {saveMsg && <div className={`px-4 py-2 text-xs font-medium sm:px-6 lg:px-8 ${saveMsg.startsWith("Auto-save failed") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{saveMsg}</div>}

        {/* DOCK / staging tray */}
        <div className="sticky top-[53px] z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">Presentation order <span className="text-zinc-400">({deckSlides.length} slide{deckSlides.length !== 1 ? "s" : ""})</span></h2>
            {deckSlides.length > 0 && <button type="button" onClick={() => setDeckSlides([])} className="text-[11px] font-medium text-zinc-400 hover:text-red-500">Clear all</button>}
          </div>
          <DockZone deck={deckSlides} onRemove={removeFromDeck} onPreview={setPreviewSlide} />
        </div>

        {/* SUMMARY builder — collapsible, on-page */}
        <div className="border-b border-zinc-100 bg-white px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setSummaryOpen((v) => !v)} className="flex w-full items-center justify-between py-3 text-left">
            <span className="text-sm font-bold text-zinc-900">Summary slide <span className="font-normal text-zinc-400">— {summaryRows.length} suggestion{summaryRows.length !== 1 ? "s" : ""} (shown last)</span></span>
            <svg className={`size-4 text-zinc-400 transition-transform ${summaryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {summaryOpen && (
            <div className="pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <select defaultValue="" onChange={(e) => { if (e.target.value) { addSummaryFromPreset(e.target.value); e.target.value = "" } }} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 focus:border-[var(--k-accent)] focus:outline-none">
                  <option value="">＋ Add a suggestion…</option>
                  {txPresets.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.visits} · {p.fee}</option>)}
                </select>
                <button type="button" onClick={() => setManagePresets((v) => !v)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50">{managePresets ? "Done editing" : "Edit my suggestions"}</button>
              </div>

              {summaryRows.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
                  <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_auto] gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    <span>Treatment</span><span>Visits</span><span>Investment</span><span></span>
                  </div>
                  {summaryRows.map((r) => (
                    <div key={r.id} className="grid grid-cols-[1.3fr_0.9fr_0.9fr_auto] items-center gap-2 border-b border-zinc-50 px-3 py-2">
                      <input value={r.treatment} onChange={(e) => updateSummaryRow(r.id, { treatment: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-800 hover:border-zinc-200 focus:border-[var(--k-accent)] focus:outline-none" />
                      <input value={r.visits} onChange={(e) => updateSummaryRow(r.id, { visits: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-600 hover:border-zinc-200 focus:border-[var(--k-accent)] focus:outline-none" />
                      <input value={r.investment} onChange={(e) => updateSummaryRow(r.id, { investment: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-600 hover:border-zinc-200 focus:border-[var(--k-accent)] focus:outline-none" />
                      <button type="button" onClick={() => removeSummaryRow(r.id)} className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500"><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                    </div>
                  ))}
                </div>
              )}

              {managePresets && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">My go-to suggestions (treatment · visits · fee)</p>
                  <div className="space-y-2">
                    {txPresets.map((p, i) => (
                      <div key={p.id} className="grid grid-cols-[1.3fr_0.9fr_0.9fr_auto] items-center gap-2">
                        <input value={p.name} onChange={(e) => setTxPresets((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs" placeholder="Treatment" />
                        <input value={p.visits} onChange={(e) => setTxPresets((prev) => prev.map((x, xi) => (xi === i ? { ...x, visits: e.target.value } : x)))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs" placeholder="Visits" />
                        <input value={p.fee} onChange={(e) => setTxPresets((prev) => prev.map((x, xi) => (xi === i ? { ...x, fee: e.target.value } : x)))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs" placeholder="Fee" />
                        <button type="button" onClick={() => setTxPresets((prev) => prev.filter((x) => x.id !== p.id))} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"><svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setTxPresets((prev) => [...prev, { id: `p-${Date.now()}`, name: "", visits: "", fee: "" }])} className="mt-2 w-full rounded-lg border border-dashed border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">＋ Add a go-to suggestion</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LIBRARY */}
        <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
          {/* Most Used favorites row */}
          {favSlides.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--k-accent)]">★ Most Used</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {favSlides.map((slide) => (
                  <div key={slide.slide_number} onDoubleClick={() => addToDeck(slide)} className={`group relative w-[140px] shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm ${deckNumbers.has(slide.slide_number) ? "border-[#f97316]/70" : "border-zinc-200"}`}>
                    <button type="button" onClick={() => toggleFav(slide.slide_number)} title="Unpin" className="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-[var(--k-accent)] text-white shadow"><StarIcon filled /></button>
                    <button type="button" onClick={() => setPreviewSlide(slide)}><SlideImg slide={slide} className="aspect-[4/3] w-full" /></button>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className="truncate text-[10px] text-zinc-500">{getSlideTitle(slide)}</span>
                      <button type="button" onClick={() => addToDeck(slide)} disabled={deckNumbers.has(slide.slide_number)} className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white disabled:bg-zinc-200 disabled:text-zinc-400">{deckNumbers.has(slide.slide_number) ? "✓" : "Add"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Slide Library</h2>
              <p className="mt-1 text-xs text-zinc-500">Double-click (or drag up) to add to the presentation. ★ pins to Most Used. Hover to delete.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Search slides…" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-300 focus:border-[var(--k-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--k-accent)]/30 sm:w-64" />
              <div className="min-w-[150px]"><p className="mb-1 text-[11px] font-medium text-zinc-500">Size</p><Slider value={[thumbnailSize]} min={140} max={300} step={10} onValueChange={(v) => setThumbnailSize(v[0] ?? 200)} /></div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-500">{filteredSlides.length} slides</span>
            </div>
          </div>

          {filteredSlides.length === 0 ? (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400">No slides match “{searchText}”.</div>
          ) : (
            <SortableContext items={filteredSlides.map((s) => `L:${s.slide_number}`)} strategy={rectSortingStrategy}>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>
                {filteredSlides.map((slide) => (
                  <LibraryCard key={slide.slide_number} slide={slide} inDeck={deckNumbers.has(slide.slide_number)} fav={favSet.has(slide.slide_number)} onAdd={() => addToDeck(slide)} onPreview={() => setPreviewSlide(slide)} onDelete={() => handleDelete(slide)} onToggleFav={() => toggleFav(slide.slide_number)} />
                ))}
              </div>
            </SortableContext>
          )}
        </div>

        <StaffStepNav current="deck" requestId={request.id} />

        <DragOverlay>{activeSlide ? <div className="w-[150px] overflow-hidden rounded-xl border-2 border-[var(--k-accent)] bg-white shadow-2xl"><SlideImg slide={activeSlide} className="aspect-[4/3] w-full" /></div> : null}</DragOverlay>

        {previewSlide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewSlide(null)}>
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-zinc-900">{getSlideTitle(previewSlide)}</h3>
                <div className="flex items-center gap-2">
                  {!deckNumbers.has(previewSlide.slide_number) && <button type="button" onClick={() => { addToDeck(previewSlide); setPreviewSlide(null) }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">Add to Deck</button>}
                  <button type="button" onClick={() => setPreviewSlide(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100"><img src={slideImageUrl(previewSlide.full_slide_image || previewSlide.images[0] || "")} alt={`Slide ${previewSlide.slide_number}`} className="max-h-[70vh] w-full object-contain" /></div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
