"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  getVCRequest,
  listAllSlides,
  slideImageUrl,
  photoUrl,
  createRecordingDeck,
  listRecordingDecks,
  deleteRecordingDeck,
  updateVCRequest,
  deleteSlide,
  uploadSlides,
  listDeckTemplates,
  suggestDeckTemplate,
  applyDeckTemplate,
  saveDeckTemplate,
  deleteDeckTemplate,
} from "@/lib/api"
import type { VCRequestListItem, SlideItem, RecordingDeck, DeckTemplate } from "@/lib/api"
import {
  rememberFees,
  recallFees,
  saveStackUndo,
  readStackUndo,
  clearStackUndo,
  stackConsultNote,
  markWrongStack,
} from "@/lib/staff-ops"
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
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, rectSortingStrategy, useSortable, arrayMove, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/* Smooth, natural sortable motion shared by the dock, library, and Most Used. */
const animateLayoutChanges: AnimateLayoutChanges = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true })
const SORT_TRANSITION = { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)" }
const DROP_ANIMATION: DropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
}

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

/* Persist only CHECKED rows. Unchecked rows are checklist scaffolding that
   rebuilds from the current go-to presets on load — persisting them by name
   left stale duplicates behind whenever a preset was renamed. */
function summaryRowsToItems(rows: SummaryRow[]) {
  return rows.filter((r) => r.enabled).map(({ treatment, visits, investment, enabled }) => ({ treatment, visits, investment, enabled }))
}

/** Full checklist: saved/stack rows first IN THEIR SAVED ORDER (the order is
 *  draggable and shows on the summary slide), then any unchecked go-to presets. */
function buildSummaryChecklist(
  presets: TxPreset[],
  items: DeckTemplate["recommendation_items"] | SummaryRow[] | undefined
): SummaryRow[] {
  const rows: SummaryRow[] = []
  const seenNames = new Set<string>()
  const usedPresets = new Set<string>()
  let i = 0
  for (const it of items ?? []) {
    const treatment = (it.treatment || "").trim()
    if (!treatment) continue
    const key = treatment.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    const preset = presets.find((p) => p.name.trim().toLowerCase() === key)
    if (preset) usedPresets.add(preset.id)
    rows.push({
      id: preset ? `preset-${preset.id}` : `custom-${Date.now()}-${i++}`,
      treatment: it.treatment,
      visits: (it.visits || preset?.visits || "").trim(),
      investment: (it.investment || preset?.fee || "").trim(),
      enabled: it.enabled !== false,
    })
  }
  for (const p of presets) {
    if (usedPresets.has(p.id)) continue
    rows.push({
      id: `preset-${p.id}`,
      treatment: p.name,
      visits: (p.visits || "").trim(),
      investment: (p.fee || "").trim(),
      enabled: false,
    })
  }
  return rows
}

function templateToSummaryRows(
  items: DeckTemplate["recommendation_items"] | undefined,
  presets: TxPreset[] = DEFAULT_TX_PRESETS
): SummaryRow[] {
  return buildSummaryChecklist(presets, items)
}

type DraftDeckState = { slide_numbers: number[]; recommendation_items?: ReturnType<typeof summaryRowsToItems>; updated_at: string }
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
  window.localStorage.setItem(draftKey(id), JSON.stringify({ slide_numbers: slideNumbers, recommendation_items: summaryRowsToItems(rows), updated_at: new Date().toISOString() }))
}
function clearDraftDeck(id: number) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(draftKey(id))
}
function resolveDeckSlides(slideNumbers: number[], map: Map<number, SlideItem>) {
  return slideNumbers.map((n) => map.get(n)).filter(Boolean) as SlideItem[]
}

/* Signature used to decide whether the deck (slides + summary) has changed
   since the last successful save — keeps autosave from firing needlessly. */
function saveSignature(slideNumbers: number[], rows: SummaryRow[]): string {
  return `${slideNumbers.join(",")}::${JSON.stringify(rows.map((r) => ({ t: r.treatment, v: r.visits, i: r.investment, e: r.enabled })))}`
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

/* Stack rail preferences — manual order + apply counts. Kept in localStorage
   (like favs/libOrder) because the backend template model has no such fields. */
const STACK_ORDER_KEY = "vc-stack-order"
function readStackOrder(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STACK_ORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}
const STACK_USES_KEY = "vc-stack-uses"
function readStackUses(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STACK_USES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

/* Summary column width — resizable, remembered across visits. */
const SUMMARY_W_KEY = "vc-summary-width"
const SUMMARY_W_DEFAULT = 336
const SUMMARY_W_MIN = 280
const SUMMARY_W_MAX = 560
function readSummaryWidth(): number {
  if (typeof window === "undefined") return SUMMARY_W_DEFAULT
  const n = Number(window.localStorage.getItem(SUMMARY_W_KEY))
  return Number.isFinite(n) && n >= SUMMARY_W_MIN && n <= SUMMARY_W_MAX ? n : SUMMARY_W_DEFAULT
}

/* Slides the user deleted — persisted so they never reload, even if the
   backend catalog is reseeded on a deploy. */
const DELETED_KEY = "vc-deleted-slides"
function readDeleted(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(DELETED_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}
function writeDeleted(nums: number[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(new Set(nums))))
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

function StarIcon({ filled, className = "size-4" }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.05 4.15 4.58.67-3.31 3.23.78 4.56-4.1-2.15-4.1 2.15.78-4.56-3.31-3.23 4.58-.67 2.05-4.15z" />
    </svg>
  )
}

/* ── dock (tray) item — sortable ─────────────────────────── */

function DockItem({ slide, index, onRemove, onPreview }: { slide: SlideItem; index: number; onRemove: () => void; onPreview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `D:${slide.slide_number}`, animateLayoutChanges, transition: SORT_TRANSITION })
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `L:${slide.slide_number}`, animateLayoutChanges, transition: SORT_TRANSITION })
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
      <div className="relative">
        <button type="button" {...attributes} {...listeners} onClick={onPreview} className="block w-full cursor-grab text-left active:cursor-grabbing" title="Double-click to add · drag up · click to preview">
          <SlideImg slide={slide} className="aspect-[4/3] w-full" />
        </button>
        {!inDeck && (
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onAdd} title="Add to presentation (or double-click the slide)" className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 opacity-0 shadow ring-1 ring-zinc-200 backdrop-blur transition hover:bg-white hover:text-zinc-900 group-hover:opacity-100">+ Add</button>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-zinc-600" title={getSlideTitle(slide)}>{getSlideTitle(slide)}</p>
      </div>
    </div>
  )
}

/* ── Most Used favorite — sortable (drag to reorder) ─────── */

function FavCard({ slide, inDeck, onAdd, onUnpin, onPreview }: { slide: SlideItem; inDeck: boolean; onAdd: () => void; onUnpin: () => void; onPreview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `F:${slide.slide_number}`, animateLayoutChanges, transition: SORT_TRANSITION })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : undefined }
  return (
    <div ref={setNodeRef} style={style} onDoubleClick={onAdd} className={`group relative w-[140px] shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm ${inDeck ? "border-[#f97316]/70" : "border-zinc-200"}`}>
      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onUnpin} title="Unpin from Most Used" className="absolute left-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-[var(--k-accent)] text-white shadow">
        <StarIcon filled />
      </button>
      <div className="relative">
        <button type="button" {...attributes} {...listeners} onClick={onPreview} className="block w-full cursor-grab text-left active:cursor-grabbing" title="Drag to reorder · double-click to add">
          <SlideImg slide={slide} className="aspect-[4/3] w-full" />
        </button>
        {!inDeck && (
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onAdd} title="Add to presentation (or double-click the slide)" className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 opacity-0 shadow ring-1 ring-zinc-200 transition hover:bg-white group-hover:opacity-100">+ Add</button>
        )}
      </div>
      <div className="px-2 py-1.5">
        <span className="truncate text-[10px] text-zinc-500">{getSlideTitle(slide)}</span>
      </div>
    </div>
  )
}

/* ── stack (deck template) button — left rail ────────────── */

function formatSuggestReason(reason?: string): string | null {
  if (!reason) return null
  if (reason === "default_cosmetic" || reason === "fallback_smile_project" || reason === "fallback_first") {
    return "Common cosmetic starting point"
  }
  if (reason === "keyword_match") return "Matched your concern keywords"
  const parts = reason.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length) return `Matched: ${parts.join(", ")}`
  return reason
}

/* ── summary row — sortable (drag to set the order on the summary slide) ── */

function SummaryRowItem({
  r,
  onUpdate,
  onRemove,
  onRename,
}: {
  r: SummaryRow
  onUpdate: (id: string, patch: Partial<SummaryRow>) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `S:${r.id}`, animateLayoutChanges, transition: SORT_TRANSITION })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 30 : undefined }
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(r.treatment)
  const commitTitle = () => {
    setEditingTitle(false)
    const clean = titleDraft.trim()
    if (clean && clean !== r.treatment) onRename(r.id, clean)
  }
  return (
    <div ref={setNodeRef} style={style} className={`group/row relative border-b border-zinc-100 last:border-b-0 ${r.enabled ? "bg-white" : "bg-zinc-50/40"}`}>
      {/* header band — gray strip separates each treatment visually */}
      <div className={`flex items-center gap-1 py-1.5 pl-1 pr-2.5 ${r.enabled ? "bg-zinc-100/80" : "bg-zinc-100/40"}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          title="Drag to reorder — this order shows on the summary slide"
          className="flex h-5 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-300 opacity-0 transition active:cursor-grabbing group-hover/row:opacity-100 hover:text-zinc-500"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
        <input
          type="checkbox"
          checked={r.enabled}
          onChange={(e) => onUpdate(r.id, { enabled: e.target.checked })}
          aria-label={`Include ${r.treatment || "custom treatment"} on the summary slide`}
          className="size-4 shrink-0 cursor-pointer rounded border-zinc-300 text-[var(--k-accent)] focus:ring-[var(--k-accent)]"
        />
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitTitle() }
              if (e.key === "Escape") { e.preventDefault(); setEditingTitle(false); setTitleDraft(r.treatment) }
            }}
            onBlur={commitTitle}
            className="min-w-0 flex-1 rounded-md border border-[var(--k-accent)] bg-white px-1.5 py-0.5 text-xs font-semibold text-zinc-900 outline-none ring-1 ring-[var(--k-accent-soft)]"
            aria-label="Treatment name"
            placeholder="Treatment name"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setTitleDraft(r.treatment); setEditingTitle(true) }}
            title="Click to rename this treatment"
            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs font-semibold transition hover:bg-white/80 hover:ring-1 hover:ring-zinc-200 ${r.enabled ? "text-zinc-900" : "text-zinc-400"}`}
          >
            {r.treatment || "Custom treatment"}
          </button>
        )}
        {!r.id.startsWith("preset-") && (
          <button
            type="button"
            onClick={() => onRemove(r.id)}
            className="shrink-0 rounded p-0.5 text-zinc-300 hover:bg-red-50 hover:text-red-500"
            aria-label="Remove custom treatment"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      <div className={`grid grid-cols-2 gap-2 py-2 pl-7 pr-3 ${r.enabled ? "" : "opacity-50"}`}>
        <label className="block">
          <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-zinc-400">Visits</span>
          <input
            value={r.visits}
            disabled={!r.enabled}
            onChange={(e) => {
              const visits = e.target.value
              onUpdate(r.id, { visits })
              if (r.enabled && r.treatment.trim()) rememberFees(r.treatment, visits, r.investment)
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-[var(--k-accent)] focus:ring-1 focus:ring-[var(--k-accent-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
            placeholder="e.g. 3 visits"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-zinc-400">Fee</span>
          <input
            value={r.investment}
            disabled={!r.enabled}
            onChange={(e) => {
              const investment = e.target.value
              onUpdate(r.id, { investment })
              if (r.enabled && r.treatment.trim()) rememberFees(r.treatment, r.visits, investment)
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-[var(--k-accent)] focus:ring-1 focus:ring-[var(--k-accent-soft)] disabled:cursor-not-allowed disabled:bg-zinc-50"
            placeholder="$…"
          />
        </label>
      </div>
    </div>
  )
}

/* Naming card for "+ New stack" and "Save as copy" — replaces window.prompt. */
function StackNameCard({
  mode,
  deckCount,
  busy,
  onSave,
  onCancel,
}: {
  mode: "new" | "copy"
  deckCount: number
  busy: boolean
  onSave: (name: string, caseType: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [caseType, setCaseType] = useState("")
  const canSave = name.trim().length > 0 && (mode === "copy" || deckCount > 0)
  return (
    <div className="mb-2 rounded-xl border border-[var(--k-accent)]/40 bg-[var(--k-accent-soft)]/30 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {mode === "copy" ? "Save edited stack as a copy" : `New stack from current order (${deckCount} slide${deckCount !== 1 ? "s" : ""})`}
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSave && !busy) { e.preventDefault(); onSave(name.trim(), caseType) }
          if (e.key === "Escape") { e.preventDefault(); onCancel() }
        }}
        placeholder='Name — e.g. "Smile Makeover — Veneers"'
        className="mb-1.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-300 focus:border-[var(--k-accent)] focus:ring-1 focus:ring-[var(--k-accent-soft)]"
        aria-label="Stack name"
      />
      {mode === "new" && (
        <input
          value={caseType}
          onChange={(e) => setCaseType(e.target.value)}
          placeholder="Case type (optional) — e.g. cosmetic"
          className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-300 focus:border-[var(--k-accent)] focus:ring-1 focus:ring-[var(--k-accent-soft)]"
          aria-label="Case type"
        />
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSave(name.trim(), caseType)}
          disabled={!canSave || busy}
          className="rounded-lg bg-[var(--k-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[var(--k-accent-strong)] disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save stack"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100">
          Cancel
        </button>
      </div>
      {mode === "new" && deckCount === 0 && <p className="mt-1.5 text-[10px] text-amber-700">Add slides to the presentation order first.</p>}
    </div>
  )
}

function StackRow({
  tpl,
  suggested,
  applied,
  applying,
  disabled,
  uses,
  slideMap,
  renaming,
  menuOpen,
  concern,
  onApply,
  onWrong,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleMenu,
  onEditSlides,
  onDuplicate,
  onDelete,
}: {
  tpl: DeckTemplate
  suggested: boolean
  applied: boolean
  applying: boolean
  disabled: boolean
  uses: number
  slideMap: Map<number, SlideItem>
  renaming: boolean
  menuOpen: boolean
  concern: string
  onApply: () => void
  onWrong?: () => void
  onStartRename: () => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  onToggleMenu: () => void
  onEditSlides: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `T:${tpl.id}`, animateLayoutChanges, transition: SORT_TRANSITION, disabled: disabled || renaming })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging || menuOpen ? 40 : undefined }
  const [nameDraft, setNameDraft] = useState(tpl.name)
  const [hovered, setHovered] = useState(false)
  const [showStrip, setShowStrip] = useState(false)
  const stripTimer = useRef<number | null>(null)
  useEffect(() => setNameDraft(tpl.name), [tpl.name, renaming])
  useEffect(() => {
    if (hovered && !isDragging && !menuOpen && !renaming) {
      stripTimer.current = window.setTimeout(() => setShowStrip(true), 350)
    } else {
      setShowStrip(false)
    }
    return () => { if (stripTimer.current) window.clearTimeout(stripTimer.current) }
  }, [hovered, isDragging, menuOpen, renaming])
  const why = suggested ? formatSuggestReason(tpl.suggest_reason) : null
  const title = [tpl.description, why].filter(Boolean).join(" — ") || tpl.name
  const stripSlides = tpl.slide_numbers.map((n) => slideMap.get(n)).filter(Boolean).slice(0, 5) as SlideItem[]
  return (
    <div ref={setNodeRef} style={style} className="relative space-y-1" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* whole row is draggable (listeners here); a click without movement still applies */}
      <div
        {...(disabled || renaming ? {} : { ...attributes, ...listeners })}
        className={`group relative flex w-full select-none items-center gap-1.5 rounded-xl border py-2 pl-1 pr-2 text-left transition ${isDragging ? "cursor-grabbing" : ""} ${
          applied
            ? "border-[var(--k-accent)] bg-[var(--k-accent-soft)]"
            : suggested
            ? "border-amber-300 bg-amber-50/70 hover:bg-amber-50"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          title="Drag to reorder stacks"
          className={`flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-300 transition ${disabled || renaming ? "invisible" : "opacity-0 group-hover:opacity-100"}`}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </span>
        <button
          type="button"
          onClick={onApply}
          disabled={applying || disabled || renaming}
          title={disabled ? undefined : `Apply to this patient — ${title}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
        >
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${applied ? "bg-[var(--k-accent)] text-white" : "bg-zinc-100 text-zinc-500"}`}>
            {tpl.slide_numbers.length}
          </span>
          <span className="min-w-0 flex-1">
            {renaming ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); onCommitRename(nameDraft.trim()) }
                  if (e.key === "Escape") { e.preventDefault(); onCancelRename() }
                }}
                onBlur={() => onCommitRename(nameDraft.trim())}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-md border border-[var(--k-accent)] bg-white px-1.5 py-0.5 text-xs font-semibold text-zinc-800 outline-none ring-1 ring-[var(--k-accent-soft)]"
                aria-label="Stack name"
              />
            ) : (
              <span className="flex items-center gap-1">
                {suggested && <StarIcon filled className="size-3 shrink-0 text-amber-500" />}
                <span className="truncate text-xs font-semibold text-zinc-800">{tpl.name}</span>
              </span>
            )}
            {!renaming && (
              <span className="block truncate text-[10px] text-zinc-400">
                {why || (tpl.case_type ? `${tpl.case_type} · ` : "") + `${tpl.slide_numbers.length} slides`}
                {uses > 0 && <span className="text-zinc-300"> · used ×{uses}</span>}
              </span>
            )}
          </span>
          {applying ? (
            <svg className="size-3.5 shrink-0 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : applied ? (
            <svg className="size-3.5 shrink-0 text-[var(--k-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onToggleMenu}
          disabled={disabled}
          title="Stack options"
          aria-label={`Options for stack ${tpl.name}`}
          className={`flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 ${menuOpen ? "bg-zinc-100 text-zinc-600" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
        </button>
      </div>
      {menuOpen && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {[
            { label: "Rename", action: onStartRename },
            { label: "Edit slides", action: onEditSlides },
            { label: "Duplicate", action: onDuplicate },
          ].map((it) => (
            <button key={it.label} type="button" onClick={it.action} className="block w-full px-3 py-1.5 text-left text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
              {it.label}
            </button>
          ))}
          <button type="button" onClick={onDelete} className="block w-full px-3 py-1.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50">
            Delete…
          </button>
        </div>
      )}
      {showStrip && stripSlides.length > 0 && !menuOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-full z-30 mt-1 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
          {stripSlides.map((s) => (
            <SlideImg key={s.slide_number} slide={s} className="aspect-[4/3] w-[46px] rounded-md" />
          ))}
          {tpl.slide_numbers.length > 5 && <span className="px-1 text-[10px] font-semibold text-zinc-400">+{tpl.slide_numbers.length - 5}</span>}
        </div>
      )}
      {suggested && onWrong && (
        <button
          type="button"
          onClick={() => {
            markWrongStack(concern, tpl.id, tpl.name)
            onWrong()
          }}
          className="w-full rounded-lg px-2 py-1 text-left text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600"
        >
          Not the right stack for this concern
        </button>
      )}
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
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null)

  const [deckSlides, setDeckSlides] = useState<SlideItem[]>([])
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [txPresets, setTxPresets] = useState<TxPreset[]>(DEFAULT_TX_PRESETS)
  const [favs, setFavs] = useState<number[]>([])
  const [libOrder, setLibOrder] = useState<number[]>([])
  const [existingDeckId, setExistingDeckId] = useState<number | null>(null)
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const lastSavedRef = useRef<string>("")

  /* stacks (deck templates) */
  const [templates, setTemplates] = useState<DeckTemplate[]>([])
  const [suggestedTemplateId, setSuggestedTemplateId] = useState<number | null>(null)
  const [appliedTemplateId, setAppliedTemplateId] = useState<number | null>(null)
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(null)
  const [savingStack, setSavingStack] = useState(false)
  const [undoAvailable, setUndoAvailable] = useState(false)
  const [stackOrder, setStackOrder] = useState<number[]>([])
  const [stackUses, setStackUses] = useState<Record<string, number>>({})
  const [renamingStackId, setRenamingStackId] = useState<number | null>(null)
  const [stackMenuId, setStackMenuId] = useState<number | null>(null)
  const [namingCard, setNamingCard] = useState<null | { mode: "new" | "copy" }>(null)
  const [editingStack, setEditingStack] = useState<DeckTemplate | null>(null)
  const editSnapshotRef = useRef<{ slides: SlideItem[]; rows: SummaryRow[]; sig: string } | null>(null)
  const deletedStackRef = useRef<(Partial<DeckTemplate> & { name: string; slide_numbers: number[] }) | null>(null)
  const [undoDeleteAvailable, setUndoDeleteAvailable] = useState(false)

  /* resizable summary column */
  const [summaryWidth, setSummaryWidth] = useState(SUMMARY_W_DEFAULT)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)

  const [previewSlide, setPreviewSlide] = useState<SlideItem | null>(null)
  const [previewPhotoIdx, setPreviewPhotoIdx] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const [managePresets, setManagePresets] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const initialized = useMemo(() => ({ done: false }), [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    async function load() {
      try {
        const reqData = await getVCRequest(requestId)
        setRequest(reqData)
        const concern = reqData.concern || reqData.message || ""

        const [slideData, deckData] = await Promise.all([listAllSlides(), listRecordingDecks()])
        const deletedSet = new Set(readDeleted())
        const liveSlides = slideData.slides.filter((s: SlideItem) => !deletedSet.has(s.slide_number))
        setAllSlides(liveSlides)
        setTxPresets(readTxPresets())
        const presets = readTxPresets()
        setFavs(readFavs())
        setStackOrder(readStackOrder())
        setStackUses(readStackUses())
        setSummaryWidth(readSummaryWidth())
        const allNums = liveSlides.map((s: SlideItem) => s.slide_number)
        const storedOrder = readLibOrder()
        setLibOrder([...storedOrder.filter((n) => allNums.includes(n)), ...allNums.filter((n) => !storedOrder.includes(n))])
        const map = new Map(liveSlides.map((s: SlideItem) => [s.slide_number, s]))
        const existingDeck = reqData.deck_id ? deckData.decks.find((d: RecordingDeck) => d.id === reqData.deck_id) ?? null : null
        setExistingDeckId(existingDeck?.id ?? null)
        if (reqData.status === "sent") clearDraftDeck(requestId)
        const draft = reqData.status === "sent" ? null : readDraftDeck(requestId)
        if (draft?.slide_numbers?.length) {
          setDeckSlides(resolveDeckSlides(draft.slide_numbers, map))
          setSummaryRows(
            buildSummaryChecklist(
              presets,
              draft.recommendation_items?.length ? draft.recommendation_items : existingDeck?.recommendation_items
            )
          )
          setSaveMsg("Loaded your in-progress deck draft.")
          lastSavedRef.current = existingDeck
            ? saveSignature(existingDeck.slide_numbers, templateToSummaryRows(existingDeck.recommendation_items, presets))
            : ""
        } else if (existingDeck) {
          setDeckSlides(resolveDeckSlides(existingDeck.slide_numbers, map))
          const rows = templateToSummaryRows(existingDeck.recommendation_items, presets)
          setSummaryRows(rows)
          lastSavedRef.current = saveSignature(existingDeck.slide_numbers, rows)
        } else {
          // Empty patient: show full treatment checklist (unchecked) so fees can be set immediately
          setSummaryRows(buildSummaryChecklist(presets, undefined))
        }

        // Stacks are a newer, independently-deployed feature — never let it block the builder.
        const [templatesResult, suggestResult] = await Promise.allSettled([listDeckTemplates(), suggestDeckTemplate(concern)])
        if (templatesResult.status === "fulfilled") setTemplates(templatesResult.value.templates)
        if (suggestResult.status === "fulfilled") setSuggestedTemplateId(suggestResult.value.suggested?.id ?? null)

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
    if (editingStack) return // stack editing must never touch the patient's draft
    if (request?.status === "sent") { clearDraftDeck(requestId); return }
    if (deckSlides.length > 0 || summaryRows.length > 0) writeDraftDeck(requestId, deckSlides.map((s) => s.slide_number), summaryRows)
    else clearDraftDeck(requestId)
  }, [requestId, request?.status, deckSlides, summaryRows, initialized, editingStack])

  /* Persist ONLY after load — the mount pass would otherwise write initial
     state over what's stored before load() has read it (this silently wiped
     go-to edits, Most Used pins, and the summary width on every reload). */
  useEffect(() => { if (typeof window !== "undefined" && initialized.done) window.localStorage.setItem(TX_PRESETS_KEY, JSON.stringify(txPresets)) }, [txPresets, initialized])
  useEffect(() => { if (typeof window !== "undefined" && initialized.done) window.localStorage.setItem(FAV_KEY, JSON.stringify(favs)) }, [favs, initialized])
  useEffect(() => { if (typeof window !== "undefined" && initialized.done && libOrder.length) window.localStorage.setItem(LIB_ORDER_KEY, JSON.stringify(libOrder)) }, [libOrder, initialized])
  useEffect(() => { if (typeof window !== "undefined" && initialized.done && stackOrder.length) window.localStorage.setItem(STACK_ORDER_KEY, JSON.stringify(stackOrder)) }, [stackOrder, initialized])
  useEffect(() => { if (typeof window !== "undefined" && initialized.done && Object.keys(stackUses).length) window.localStorage.setItem(STACK_USES_KEY, JSON.stringify(stackUses)) }, [stackUses, initialized])
  useEffect(() => { if (typeof window !== "undefined" && initialized.done) window.localStorage.setItem(SUMMARY_W_KEY, String(summaryWidth)) }, [summaryWidth, initialized])

  const deckNumbers = useMemo(() => new Set(deckSlides.map((s) => s.slide_number)), [deckSlides])
  const favSet = useMemo(() => new Set(favs), [favs])
  const slideMap = useMemo(() => new Map(allSlides.map((s) => [s.slide_number, s])), [allSlides])

  const orderedSlides = useMemo(() => {
    if (!libOrder.length) return allSlides
    const idx = new Map(libOrder.map((n, i) => [n, i]))
    return [...allSlides].sort((a, b) => (idx.get(a.slide_number) ?? 1e9) - (idx.get(b.slide_number) ?? 1e9))
  }, [allSlides, libOrder])

  /* Top treatment tags across the library — drives the filter chip row. */
  const treatmentChips = useMemo(() => {
    const freq = new Map<string, number>()
    for (const s of allSlides) {
      for (const raw of s.treatments || []) {
        const t = raw.trim()
        if (!t) continue
        freq.set(t, (freq.get(t) ?? 0) + 1)
      }
    }
    return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)
  }, [allSlides])

  const filteredSlides = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return orderedSlides.filter((s) => {
      if (selectedTreatment && !(s.treatments || []).some((t) => t.toLowerCase() === selectedTreatment.toLowerCase())) return false
      if (!q) return true
      return [s.condition, s.solution, String(s.slide_number), ...(s.text_content || [])].join(" ").toLowerCase().includes(q)
    })
  }, [orderedSlides, searchText, selectedTreatment])

  const favSlides = useMemo(() => favs.map((n) => allSlides.find((s) => s.slide_number === n)).filter(Boolean) as SlideItem[], [favs, allSlides])

  const addToDeck = useCallback((slide: SlideItem) => {
    setDeckSlides((prev) => (prev.some((d) => d.slide_number === slide.slide_number) ? prev : [...prev, slide]))
    setSaveMsg(null)
  }, [])
  const removeFromDeck = useCallback((n: number) => { setDeckSlides((prev) => prev.filter((s) => s.slide_number !== n)); setSaveMsg(null) }, [])
  const toggleFav = useCallback((n: number) => setFavs((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [n, ...prev])), [])

  const handleDelete = useCallback(async (slide: SlideItem) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${getSlideTitle(slide)}" from the library? This removes the image for good.`)) return
    // Record the deletion locally so it never reloads, even across backend deploys.
    writeDeleted([...readDeleted(), slide.slide_number])
    setAllSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    setDeckSlides((prev) => prev.filter((s) => s.slide_number !== slide.slide_number))
    setFavs((prev) => prev.filter((x) => x !== slide.slide_number))
    setLibOrder((prev) => prev.filter((n) => n !== slide.slide_number))
    try { await deleteSlide(slide.slide_number) } catch { /* optimistic — local hide still applies */ }
  }, [])

  /* Add new slides to the library from image files. */
  const handleAddSlides = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (addInputRef.current) addInputRef.current.value = ""
    if (!files.length) return
    setAdding(true)
    setSaveMsg(null)
    try {
      const { created } = await uploadSlides(files)
      setAllSlides((prev) => [...created, ...prev])
      setLibOrder((prev) => [...created.map((s) => s.slide_number), ...prev])
      setSaveMsg(`Added ${created.length} slide${created.length !== 1 ? "s" : ""} to the library.`)
    } catch (err) {
      setSaveMsg(`Add failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setAdding(false)
    }
  }, [])

  /* summary rows */
  /* "Done editing go-tos" — push preset edits into the summary checklist:
     names always follow the preset; visits/fee follow it too unless the row is
     checked for this patient (per-patient values win); deleted presets drop
     their unchecked rows but never a checked one; new presets append unchecked. */
  const applyPresetEdits = useCallback(() => {
    setSummaryRows((prev) => {
      const next: SummaryRow[] = []
      const seen = new Set<string>()
      for (const r of prev) {
        if (r.id.startsWith("preset-")) {
          const pid = r.id.slice("preset-".length)
          const p = txPresets.find((x) => x.id === pid)
          if (!p) {
            if (r.enabled) next.push(r)
            continue
          }
          seen.add(pid)
          next.push({
            ...r,
            treatment: p.name.trim() ? p.name : r.treatment,
            visits: r.enabled ? r.visits : (p.visits || "").trim(),
            investment: r.enabled ? r.investment : (p.fee || "").trim(),
          })
        } else {
          next.push(r)
        }
      }
      for (const p of txPresets) {
        if (seen.has(p.id) || !p.name.trim()) continue
        next.push({ id: `preset-${p.id}`, treatment: p.name, visits: (p.visits || "").trim(), investment: (p.fee || "").trim(), enabled: false })
      }
      return next
    })
  }, [txPresets])

  const updateSummaryRow = useCallback((id: string, patch: Partial<SummaryRow>) => setSummaryRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))), [])

  /* Click-to-rename on the treatment title. Renaming a go-to row also updates
     the stored go-to preset so the new name sticks for future patients. */
  const renameSummaryTreatment = useCallback((id: string, name: string) => {
    setSummaryRows((prev) => prev.map((r) => (r.id === id ? { ...r, treatment: name } : r)))
    if (id.startsWith("preset-")) {
      const pid = id.slice("preset-".length)
      setTxPresets((prev) => prev.map((p) => (p.id === pid ? { ...p, name } : p)))
    }
  }, [])
  const removeSummaryRow = useCallback((id: string) => setSummaryRows((prev) => prev.filter((r) => r.id !== id)), [])
  const addCustomSummaryRow = useCallback(() => {
    setSummaryRows((prev) => [...prev, { id: `custom-${Date.now()}`, treatment: "", visits: "", investment: "", enabled: true }])
  }, [])

  /* stacks: apply a template to this patient — prefer server persistence, fall back to a local
     resolve that the normal autosave effect will pick up and push to the server. */
  const applyStack = useCallback(async (tpl: DeckTemplate) => {
    if (!request) return
    setApplyingTemplateId(tpl.id)
    setSaveMsg(null)
    // Snapshot for 30s undo
    saveStackUndo({
      requestId: request.id,
      slide_numbers: deckSlides.map((s) => s.slide_number),
      recommendation_items: summaryRowsToItems(summaryRows),
      deck_id: existingDeckId,
    })
    try {
      const result = await applyDeckTemplate(request.id, tpl.id)
      const map = new Map(allSlides.map((s) => [s.slide_number, s]))
      let rows = buildSummaryChecklist(txPresets, result.recommendation_items)
      // Overlay remembered fees for enabled treatments
      rows = rows.map((r) => {
        const mem = recallFees(r.treatment)
        if (!mem || !r.enabled) return r
        return { ...r, visits: mem.visits || r.visits, investment: mem.investment || r.investment }
      })
      setDeckSlides(resolveDeckSlides(result.deck.slide_numbers, map))
      setSummaryRows(rows)
      setExistingDeckId(result.deck.id)
      const note = stackConsultNote(tpl.name, request.concern || request.message || "")
      const prevNotes = (result.request.notes || "").trim()
      const mergedNotes = prevNotes ? `${prevNotes}\n${note}` : note
      try {
        await updateVCRequest(request.id, { notes: mergedNotes })
      } catch {
        /* notes are best-effort */
      }
      setRequest({ ...result.request, notes: mergedNotes })
      lastSavedRef.current = saveSignature(result.deck.slide_numbers, rows)
      writeDraftDeck(request.id, result.deck.slide_numbers, rows)
      setAppliedTemplateId(tpl.id)
      setStackUses((prev) => ({ ...prev, [tpl.id]: (prev[tpl.id] ?? 0) + 1 }))
      setAutoSaveState("saved")
      setSaveMsg(`Applied "${tpl.name}" stack. Undo available for 30s.`)
      setUndoAvailable(true)
      window.setTimeout(() => setUndoAvailable(false), 30_000)
    } catch (err) {
      const map = new Map(allSlides.map((s) => [s.slide_number, s]))
      setDeckSlides(resolveDeckSlides(tpl.slide_numbers, map))
      setSummaryRows(buildSummaryChecklist(txPresets, tpl.recommendation_items))
      setAppliedTemplateId(tpl.id)
      setSaveMsg(`Applied "${tpl.name}" locally — saving… (${err instanceof Error ? err.message : "server apply failed"})`)
      setUndoAvailable(true)
      window.setTimeout(() => setUndoAvailable(false), 30_000)
    } finally {
      setApplyingTemplateId(null)
    }
  }, [request, allSlides, txPresets, deckSlides, summaryRows, existingDeckId])

  const undoStackApply = useCallback(() => {
    if (!request) return
    const snap = readStackUndo(request.id)
    if (!snap) {
      setSaveMsg("Undo window expired.")
      setUndoAvailable(false)
      return
    }
    const map = new Map(allSlides.map((s) => [s.slide_number, s]))
    const rows = buildSummaryChecklist(txPresets, snap.recommendation_items as DeckTemplate["recommendation_items"])
    setDeckSlides(resolveDeckSlides(snap.slide_numbers, map))
    setSummaryRows(rows)
    setExistingDeckId(snap.deck_id)
    setAppliedTemplateId(null)
    clearStackUndo()
    setUndoAvailable(false)
    setSaveMsg("Reverted stack apply.")
  }, [request, allSlides, txPresets])

  /* Save the current Presentation Order as a stack — name comes from the naming card. */
  const handleSaveNewStack = useCallback(async (name: string, caseType: string) => {
    if (deckSlides.length === 0) { setSaveMsg("Add slides to the deck before saving a stack."); return }
    setSavingStack(true)
    setSaveMsg(null)
    try {
      const tpl = await saveDeckTemplate({
        name,
        case_type: caseType.trim() || "custom",
        slide_numbers: deckSlides.map((s) => s.slide_number),
        recommendation_items: summaryRowsToItems(summaryRows),
      })
      setTemplates((prev) => [tpl, ...prev.filter((t) => t.id !== tpl.id)])
      setStackOrder((prev) => (prev.length ? [tpl.id, ...prev.filter((id) => id !== tpl.id)] : prev))
      setAppliedTemplateId(tpl.id)
      setNamingCard(null)
      setSaveMsg(`Saved stack "${tpl.name}".`)
    } catch (err) {
      setSaveMsg(`Save stack failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setSavingStack(false)
    }
  }, [deckSlides, summaryRows])

  const renameStack = useCallback(async (tpl: DeckTemplate, name: string) => {
    setRenamingStackId(null)
    if (!name || name === tpl.name) return
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, name } : t)))
    try {
      await saveDeckTemplate({ id: tpl.id, name, slide_numbers: tpl.slide_numbers })
      setSaveMsg(`Renamed stack to "${name}".`)
    } catch (err) {
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, name: tpl.name } : t)))
      setSaveMsg(`Rename failed: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }, [])

  const duplicateStack = useCallback(async (tpl: DeckTemplate) => {
    setStackMenuId(null)
    try {
      const copy = await saveDeckTemplate({
        name: `${tpl.name} (copy)`,
        case_type: tpl.case_type,
        description: tpl.description,
        slide_numbers: tpl.slide_numbers,
        recommendation_items: tpl.recommendation_items,
      })
      setTemplates((prev) => {
        const i = prev.findIndex((t) => t.id === tpl.id)
        const next = [...prev]
        next.splice(i < 0 ? prev.length : i + 1, 0, copy)
        return next
      })
      setStackOrder((prev) => {
        if (!prev.length) return prev
        const i = prev.indexOf(tpl.id)
        const next = [...prev]
        next.splice(i < 0 ? prev.length : i + 1, 0, copy.id)
        return next
      })
      setSaveMsg(`Duplicated as "${copy.name}".`)
    } catch (err) {
      setSaveMsg(`Duplicate failed: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }, [])

  const deleteStack = useCallback(async (tpl: DeckTemplate) => {
    setStackMenuId(null)
    if (typeof window !== "undefined" && !window.confirm(`Delete the "${tpl.name}" stack? Patient decks already built from it are not affected.`)) return
    deletedStackRef.current = {
      name: tpl.name,
      case_type: tpl.case_type,
      description: tpl.description,
      slide_numbers: tpl.slide_numbers,
      recommendation_items: tpl.recommendation_items,
      concern_keywords: tpl.concern_keywords,
      treatment_tags: tpl.treatment_tags,
    }
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id))
    if (appliedTemplateId === tpl.id) setAppliedTemplateId(null)
    try {
      await deleteDeckTemplate(tpl.id)
      setSaveMsg(`Deleted stack "${tpl.name}". Undo available for 30s.`)
      setUndoDeleteAvailable(true)
      window.setTimeout(() => { setUndoDeleteAvailable(false); deletedStackRef.current = null }, 30_000)
    } catch (err) {
      setSaveMsg(`Delete failed: ${err instanceof Error ? err.message : "unknown error"}`)
      deletedStackRef.current = null
    }
  }, [appliedTemplateId])

  const undoDeleteStack = useCallback(async () => {
    const payload = deletedStackRef.current
    setUndoDeleteAvailable(false)
    if (!payload) { setSaveMsg("Undo window expired."); return }
    deletedStackRef.current = null
    try {
      const tpl = await saveDeckTemplate(payload)
      setTemplates((prev) => [tpl, ...prev])
      setSaveMsg(`Restored stack "${tpl.name}".`)
    } catch (err) {
      setSaveMsg(`Restore failed: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }, [])

  /* Edit-stack mode: load the stack into the Presentation Order strip; the
     patient's real deck is snapshotted and restored on exit. */
  const beginEditStack = useCallback((tpl: DeckTemplate) => {
    setStackMenuId(null)
    editSnapshotRef.current = { slides: deckSlides, rows: summaryRows, sig: lastSavedRef.current }
    const map = new Map(allSlides.map((s) => [s.slide_number, s]))
    setEditingStack(tpl)
    setNamingCard(null)
    setDeckSlides(resolveDeckSlides(tpl.slide_numbers, map))
    setSummaryRows(buildSummaryChecklist(txPresets, tpl.recommendation_items))
    setSaveMsg(null)
  }, [deckSlides, summaryRows, allSlides, txPresets])

  const exitEditStack = useCallback(() => {
    const snap = editSnapshotRef.current
    if (snap) {
      setDeckSlides(snap.slides)
      setSummaryRows(snap.rows)
      lastSavedRef.current = snap.sig
    }
    editSnapshotRef.current = null
    setEditingStack(null)
    setNamingCard(null)
  }, [])

  const saveEditedStack = useCallback(async (asCopy: boolean, copyName?: string) => {
    if (!editingStack) return
    if (deckSlides.length === 0) { setSaveMsg("A stack needs at least one slide."); return }
    setSavingStack(true)
    try {
      const tpl = await saveDeckTemplate({
        ...(asCopy ? {} : { id: editingStack.id }),
        name: asCopy ? (copyName || `${editingStack.name} (copy)`) : editingStack.name,
        case_type: editingStack.case_type,
        description: editingStack.description,
        slide_numbers: deckSlides.map((s) => s.slide_number),
        recommendation_items: summaryRowsToItems(summaryRows),
      })
      setTemplates((prev) => (asCopy ? [tpl, ...prev] : prev.map((t) => (t.id === tpl.id ? tpl : t))))
      setNamingCard(null)
      exitEditStack()
      setSaveMsg(asCopy ? `Saved copy "${tpl.name}".` : `Updated stack "${tpl.name}".`)
    } catch (err) {
      setSaveMsg(`Save stack failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setSavingStack(false)
    }
  }, [editingStack, deckSlides, summaryRows, exitEditStack])

  /* One-click: write the patient's current tweaks back to the applied stack. */
  const updateAppliedStack = useCallback(async (tpl: DeckTemplate) => {
    setSavingStack(true)
    try {
      const updated = await saveDeckTemplate({
        id: tpl.id,
        name: tpl.name,
        case_type: tpl.case_type,
        description: tpl.description,
        slide_numbers: deckSlides.map((s) => s.slide_number),
        recommendation_items: summaryRowsToItems(summaryRows),
      })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setSaveMsg(`Updated "${updated.name}" stack with this deck.`)
    } catch (err) {
      setSaveMsg(`Update stack failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setSavingStack(false)
    }
  }, [deckSlides, summaryRows])

  /* Stack rail order: manual order wins; before any manual order exists, the
     suggested stack floats to the top (original behavior). */
  const sortedTemplates = useMemo(() => {
    const arr = [...templates]
    if (stackOrder.length) {
      const idx = new Map(stackOrder.map((id, i) => [id, i]))
      arr.sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9))
    } else {
      arr.sort((a, b) => (a.id === suggestedTemplateId ? -1 : b.id === suggestedTemplateId ? 1 : 0))
    }
    return arr
  }, [templates, stackOrder, suggestedTemplateId])

  const sortStacksByMostUsed = useCallback(() => {
    const ranked = [...templates].sort((a, b) => (stackUses[b.id] ?? 0) - (stackUses[a.id] ?? 0))
    setStackOrder(ranked.map((t) => t.id))
    setSaveMsg("Stacks sorted by most used — drag any row to fine-tune.")
  }, [templates, stackUses])

  /* drag */
  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const a = String(active.id), o = String(over.id)
    if (a.startsWith("T:")) {
      if (o.startsWith("T:") && a !== o) {
        const ids = sortedTemplates.map((t) => t.id)
        const f = ids.indexOf(Number(a.slice(2))), t = ids.indexOf(Number(o.slice(2)))
        if (f >= 0 && t >= 0) setStackOrder(arrayMove(ids, f, t))
      }
      return
    }
    if (a.startsWith("S:")) {
      if (o.startsWith("S:") && a !== o) {
        setSummaryRows((prev) => {
          const f = prev.findIndex((r) => `S:${r.id}` === a), t = prev.findIndex((r) => `S:${r.id}` === o)
          return f < 0 || t < 0 ? prev : arrayMove(prev, f, t)
        })
      }
      return
    }
    if (a.startsWith("F:")) {
      if (o.startsWith("F:") && a !== o) {
        const sn = Number(a.slice(2)), on = Number(o.slice(2))
        setFavs((prev) => { const f = prev.indexOf(sn), t = prev.indexOf(on); return f < 0 || t < 0 ? prev : arrayMove(prev, f, t) })
      }
      return
    }
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
  const activeSlide = useMemo(() => (activeId && /^[FLD]:/.test(activeId) ? allSlides.find((s) => s.slide_number === Number(activeId.slice(2))) ?? null : null), [activeId, allSlides])
  const activeTpl = useMemo(() => (activeId?.startsWith("T:") ? templates.find((t) => t.id === Number(activeId.slice(2))) ?? null : null), [activeId, templates])

  const saveDeck = useCallback(async () => {
    if (!request || deckSlides.length === 0) return
    setAutoSaveState("saving")
    setSaveMsg(null)
    try {
      const name = `Request #${request.id} — ${getDisplayName(request)}`
      const slideNumbers = deckSlides.map((s) => s.slide_number)
      if (existingDeckId) { try { await deleteRecordingDeck(existingDeckId) } catch { /* ignore */ } }
      const newDeck = await createRecordingDeck(name, slideNumbers, summaryRowsToItems(summaryRows))
      setExistingDeckId(newDeck.id)
      // Only advance status when still pre-deck. Re-saving while already deck_built
      // (or later) must not re-POST the same status — backend rejects no-op transitions.
      const patch: { deck_id: number; status?: string } = { deck_id: newDeck.id }
      if (["new", "under_review", "pending", "in_progress"].includes(request.status)) {
        patch.status = "deck_built"
      }
      const updatedReq = await updateVCRequest(request.id, patch)
      setRequest(updatedReq)
      writeDraftDeck(request.id, slideNumbers, summaryRows)
      lastSavedRef.current = saveSignature(slideNumbers, summaryRows)
      setAutoSaveState("saved")
    } catch (err) {
      setAutoSaveState("error")
      setSaveMsg(`Auto-save failed: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }, [request, deckSlides, existingDeckId, summaryRows])

  /* Auto-save the deck (debounced) — no manual Save button needed. */
  useEffect(() => {
    if (!initialized.done || !requestId || Number.isNaN(requestId)) return
    if (editingStack) return // stack editing must never autosave onto the patient's deck
    if (request?.status === "sent") return
    if (deckSlides.length === 0) return
    const sig = saveSignature(deckSlides.map((s) => s.slide_number), summaryRows)
    if (sig === lastSavedRef.current) return
    setAutoSaveState("saving")
    const t = setTimeout(() => { saveDeck() }, 1200)
    return () => clearTimeout(t)
  }, [deckSlides, summaryRows, initialized, requestId, request?.status, saveDeck, editingStack])

  /* Keyboard shortcut: R jumps to the record screen once the deck has slides. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "r" && e.key !== "R") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return
      if (!request || deckSlides.length === 0 || editingStack) return
      window.location.href = `/staff/${request.id}/deck/present`
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [request, deckSlides.length, editingStack])

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

  const concern = request.concern || request.message || ""
  const appliedTpl = appliedTemplateId != null ? templates.find((t) => t.id === appliedTemplateId) ?? null : null
  const deckDiffersFromApplied =
    appliedTpl != null &&
    !editingStack &&
    (appliedTpl.slide_numbers.join(",") !== deckSlides.map((s) => s.slide_number).join(",") ||
      JSON.stringify((appliedTpl.recommendation_items || []).filter((i) => i.enabled !== false).map((i) => [i.treatment, i.visits || "", i.investment || ""])) !==
        JSON.stringify(summaryRows.filter((r) => r.enabled).map((r) => [r.treatment, r.visits, r.investment])))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex min-h-dvh flex-col bg-[var(--k-bg)] lg:h-dvh lg:overflow-hidden">
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
              {deckSlides.length > 0 && !editingStack && (
                <Link href={`/staff/${request.id}/deck/present`} className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 sm:flex">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                  Record
                </Link>
              )}
            </>
          }
        />
        {saveMsg && (
          <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs font-medium sm:px-6 lg:px-8 ${saveMsg.includes("failed") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
            <span>{saveMsg}</span>
            <span className="flex items-center gap-2">
              {undoAvailable && (
                <button type="button" onClick={undoStackApply} className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50">
                  Undo apply
                </button>
              )}
              {undoDeleteAvailable && (
                <button type="button" onClick={undoDeleteStack} className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50">
                  Undo delete
                </button>
              )}
            </span>
          </div>
        )}

        {/* 3-column workbench: Patient · Dock+Library · Summary (right column resizable) */}
        <div className="flex-1 lg:grid lg:min-h-0" style={{ gridTemplateColumns: `288px minmax(0,1fr) ${summaryWidth}px` }}>

          {/* ── LEFT: patient context — photos, concern, stacks ── */}
          <aside className="border-b border-[var(--k-line)] bg-white p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h2 className="mb-2 text-sm font-bold text-zinc-900">{getDisplayName(request)}</h2>

            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Photos</p>
            {request.photos && request.photos.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {request.photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPreviewPhotoIdx(i)} className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 transition hover:opacity-90">
                    <img src={photoUrl(p)} alt={`Patient photo ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-[11px] text-zinc-400">No photos uploaded</p>
            )}

            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Concern</p>
            <p className="mb-4 rounded-xl bg-[var(--k-bg)] px-3 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-[var(--k-line)]">
              {concern || "No concern provided"}
            </p>

            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Stacks {templates.length > 0 && <span className="font-normal normal-case text-zinc-300">· {templates.length}</span>}
              </p>
              <span className="flex items-center gap-1">
                {templates.length > 1 && (
                  <button
                    type="button"
                    onClick={sortStacksByMostUsed}
                    disabled={!!editingStack}
                    title="Reorder the list by how often each stack is applied"
                    className="rounded-md px-1.5 py-1 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40"
                  >
                    Most used ↑
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNamingCard((v) => (v?.mode === "new" ? null : { mode: "new" }))}
                  disabled={!!editingStack}
                  title="Save the current presentation order as a new stack"
                  className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 px-1.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:border-[var(--k-accent)] hover:text-[var(--k-accent)] disabled:opacity-40"
                >
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  New stack
                </button>
              </span>
            </div>
            {namingCard && (
              <StackNameCard
                mode={namingCard.mode}
                deckCount={deckSlides.length}
                busy={savingStack}
                onSave={(name, caseType) => (namingCard.mode === "copy" ? saveEditedStack(true, name) : handleSaveNewStack(name, caseType))}
                onCancel={() => setNamingCard(null)}
              />
            )}
            {templates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 text-[11px] text-zinc-400">No saved stacks yet — build a deck below, then “+ New stack” to reuse it on future patients.</p>
            ) : (
              <SortableContext items={sortedTemplates.map((t) => `T:${t.id}`)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {sortedTemplates.map((tpl) => (
                    <StackRow
                      key={tpl.id}
                      tpl={tpl}
                      suggested={tpl.id === suggestedTemplateId}
                      applied={tpl.id === appliedTemplateId}
                      applying={applyingTemplateId === tpl.id}
                      disabled={!!editingStack && editingStack.id !== tpl.id}
                      uses={stackUses[tpl.id] ?? 0}
                      slideMap={slideMap}
                      renaming={renamingStackId === tpl.id}
                      menuOpen={stackMenuId === tpl.id}
                      concern={concern}
                      onApply={() => applyStack(tpl)}
                      onStartRename={() => { setStackMenuId(null); setRenamingStackId(tpl.id) }}
                      onCommitRename={(name) => renameStack(tpl, name)}
                      onCancelRename={() => setRenamingStackId(null)}
                      onToggleMenu={() => setStackMenuId((v) => (v === tpl.id ? null : tpl.id))}
                      onEditSlides={() => beginEditStack(tpl)}
                      onDuplicate={() => duplicateStack(tpl)}
                      onDelete={() => deleteStack(tpl)}
                      onWrong={
                        tpl.id === suggestedTemplateId
                          ? () => {
                              setSuggestedTemplateId(null)
                              setSaveMsg(`Noted — won’t push “${tpl.name}” as hard for similar concerns on this device.`)
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            )}
            {deckDiffersFromApplied && appliedTpl && (
              <button
                type="button"
                onClick={() => updateAppliedStack(appliedTpl)}
                disabled={savingStack}
                title="Write this patient's current slides + summary back to the stack"
                className="mt-2 w-full rounded-xl border border-dashed border-[var(--k-accent)]/50 bg-[var(--k-accent-soft)]/40 px-3 py-2 text-left text-[11px] font-medium text-zinc-700 transition hover:bg-[var(--k-accent-soft)] disabled:opacity-50"
              >
                ↻ Update “{appliedTpl.name}” with these changes
              </button>
            )}
            {stackMenuId !== null && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setStackMenuId(null)} />}
          </aside>

          {/* ── MIDDLE: dock (order) + filters + library ── */}
          <section className="lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-[var(--k-line)]">
            <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:top-0">
              {editingStack && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-900">Editing stack: {editingStack.name}</p>
                    <p className="text-[10px] text-amber-700">Reorder, add, or remove slides below — {getDisplayName(request)}&rsquo;s own deck is untouched until you exit.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => saveEditedStack(false)}
                      disabled={savingStack || deckSlides.length === 0}
                      className="rounded-lg bg-[var(--k-accent)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[var(--k-accent-strong)] disabled:opacity-40"
                    >
                      {savingStack ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNamingCard({ mode: "copy" })}
                      disabled={savingStack || deckSlides.length === 0}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-40"
                    >
                      Save as copy…
                    </button>
                    <button type="button" onClick={exitEditStack} disabled={savingStack} className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-zinc-900">
                  {editingStack ? <>Stack slides <span className="text-zinc-400">({deckSlides.length})</span></> : <>Presentation order <span className="text-zinc-400">({deckSlides.length} slide{deckSlides.length !== 1 ? "s" : ""})</span></>}
                </h2>
                <div className="flex items-center gap-1.5">
                  {!editingStack && (
                    <button
                      type="button"
                      onClick={() => setNamingCard({ mode: "new" })}
                      disabled={savingStack || deckSlides.length === 0}
                      title="Save this deck + summary as a reusable stack (opens the card in the Stacks rail)"
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:border-[var(--k-accent)] hover:text-[var(--k-accent)] disabled:opacity-40"
                    >
                      Save as stack…
                    </button>
                  )}
                  {deckSlides.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDeckSlides([])}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <DockZone deck={deckSlides} onRemove={removeFromDeck} onPreview={setPreviewSlide} />
            </div>

            <div className="px-4 py-4 pb-24">
              {/* Most Used favorites row */}
              {favSlides.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--k-accent)]">★ Most Used</p>
                  <SortableContext items={favSlides.map((s) => `F:${s.slide_number}`)} strategy={horizontalListSortingStrategy}>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {favSlides.map((slide) => (
                        <FavCard
                          key={slide.slide_number}
                          slide={slide}
                          inDeck={deckNumbers.has(slide.slide_number)}
                          onAdd={() => addToDeck(slide)}
                          onUnpin={() => toggleFav(slide.slide_number)}
                          onPreview={() => setPreviewSlide(slide)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* Treatment filter chips */}
              {treatmentChips.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTreatment(null)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${selectedTreatment === null ? "bg-[var(--k-accent)] text-[var(--k-on-accent)]" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                  >
                    All
                  </button>
                  {treatmentChips.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTreatment((prev) => (prev === t ? null : t))}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${selectedTreatment === t ? "bg-[var(--k-accent)] text-[var(--k-on-accent)]" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Slide Library</h2>
                  <p className="mt-1 text-xs text-zinc-500">Double-click (or drag up) to add. ★ pins to Most Used. Hover to delete.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => addInputRef.current?.click()} disabled={adding} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50">
                    {adding ? (
                      <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    )}
                    {adding ? "Uploading…" : "Add slides"}
                  </button>
                  <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddSlides} />
                  <input type="text" placeholder="Search slides…" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-300 focus:border-[var(--k-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--k-accent)]/30 sm:w-56" />
                  <div className="min-w-[150px]"><p className="mb-1 text-[11px] font-medium text-zinc-500">Size</p><Slider value={[thumbnailSize]} min={140} max={300} step={10} onValueChange={(v) => setThumbnailSize(v[0] ?? 200)} /></div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-500">{filteredSlides.length} slides</span>
                </div>
              </div>

              {filteredSlides.length === 0 ? (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400">No slides match the current filters.</div>
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
          </section>

          {/* ── RIGHT: summary (always open) + sticky Record ── */}
          <aside className="relative flex flex-col border-t border-[var(--k-line)] bg-white lg:min-h-0 lg:border-t-0 lg:border-l">
            {/* drag handle: resize the summary column (double-click to reset) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize summary column"
              title="Drag to resize · double-click to reset"
              className="absolute -left-1 top-0 z-30 hidden h-full w-2 cursor-col-resize touch-none transition-colors hover:bg-[var(--k-accent)]/25 active:bg-[var(--k-accent)]/40 lg:block"
              onPointerDown={(e) => {
                e.preventDefault()
                resizeRef.current = { startX: e.clientX, startW: summaryWidth }
                const onMove = (ev: PointerEvent) => {
                  const r = resizeRef.current
                  if (!r) return
                  const w = Math.min(SUMMARY_W_MAX, Math.max(SUMMARY_W_MIN, r.startW + (r.startX - ev.clientX)))
                  setSummaryWidth(w)
                }
                const onUp = () => {
                  resizeRef.current = null
                  document.body.style.removeProperty("user-select")
                  document.body.style.removeProperty("cursor")
                  window.removeEventListener("pointermove", onMove)
                  window.removeEventListener("pointerup", onUp)
                }
                document.body.style.userSelect = "none"
                document.body.style.cursor = "col-resize"
                window.addEventListener("pointermove", onMove)
                window.addEventListener("pointerup", onUp)
              }}
              onDoubleClick={() => setSummaryWidth(SUMMARY_W_DEFAULT)}
            />
            <div className="flex-1 px-4 py-4 pb-24 lg:overflow-y-auto lg:pb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-zinc-900">Summary <span className="font-normal text-zinc-400">— check &amp; set fees</span></h2>
              </div>

              <p className="mb-3 text-[11px] leading-relaxed text-zinc-400">
                Check treatments for this patient, then edit visits and fees. Only checked items appear on the summary slide — drag the grip to set their order.
              </p>

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="grid grid-cols-[auto_1fr] gap-x-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  <span className="w-4" /><span>Treatment · visits · fee</span>
                </div>
                <SortableContext items={summaryRows.map((r) => `S:${r.id}`)} strategy={verticalListSortingStrategy}>
                  {summaryRows.map((r) => (
                    <SummaryRowItem key={r.id} r={r} onUpdate={updateSummaryRow} onRemove={removeSummaryRow} onRename={renameSummaryTreatment} />
                  ))}
                </SortableContext>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addCustomSummaryRow}
                  className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-[var(--k-accent)] hover:text-[var(--k-accent)]"
                >
                  ＋ Add custom treatment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (managePresets) applyPresetEdits()
                    setManagePresets((v) => !v)
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
                >
                  {managePresets ? "Done editing go-tos" : "Edit my go-tos"}
                </button>
              </div>

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

            {/* pinned bottom of the right column */}
            <div className="shrink-0 border-t border-[var(--k-line)] bg-white p-4 pb-20 lg:pb-4">
              {editingStack ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-center text-[11px] text-amber-800">Editing “{editingStack.name}” — save or cancel in the banner above to get back to this patient.</div>
              ) : deckSlides.length > 0 ? (
                <Link
                  href={`/staff/${request.id}/deck/present`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                  Record now
                  <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] sm:inline">R</kbd>
                </Link>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-3 text-center text-[11px] text-zinc-400">Add slides to the deck to enable recording.</div>
              )}
            </div>
          </aside>
        </div>

        <StaffStepNav current="deck" requestId={request.id} />

        <DragOverlay dropAnimation={DROP_ANIMATION}>
          {activeSlide ? (
            <div className="w-[150px] rotate-2 overflow-hidden rounded-xl border-2 border-[var(--k-accent)] bg-white shadow-2xl"><SlideImg slide={activeSlide} className="aspect-[4/3] w-full" /></div>
          ) : activeTpl ? (
            <div className="flex w-[248px] items-center gap-2.5 rounded-xl border-2 border-[var(--k-accent)] bg-white py-2 pl-2 pr-3 shadow-2xl">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-500">{activeTpl.slide_numbers.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-zinc-800">{activeTpl.name}</span>
                <span className="block truncate text-[10px] text-zinc-400">{activeTpl.slide_numbers.length} slides</span>
              </span>
            </div>
          ) : null}
        </DragOverlay>

        {previewSlide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewSlide(null)}>
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-zinc-900">{getSlideTitle(previewSlide)}</h3>
                <div className="flex items-center gap-2">
                  {!deckNumbers.has(previewSlide.slide_number) && <button type="button" onClick={() => { addToDeck(previewSlide); setPreviewSlide(null) }} className="rounded-lg bg-[var(--k-accent)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--k-accent-strong)]">Add to Deck</button>}
                  <button type="button" onClick={() => setPreviewSlide(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100"><img src={slideImageUrl(previewSlide.full_slide_image || previewSlide.images[0] || "")} alt={`Slide ${previewSlide.slide_number}`} className="max-h-[70vh] w-full object-contain" /></div>
            </div>
          </div>
        )}

        {previewPhotoIdx !== null && request.photos?.[previewPhotoIdx] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewPhotoIdx(null)}>
            <div className="relative max-h-[90vh] w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <img src={photoUrl(request.photos[previewPhotoIdx])} alt={`Patient photo ${previewPhotoIdx + 1}`} className="max-h-[85vh] w-full rounded-2xl bg-black object-contain" />
              <button type="button" onClick={() => setPreviewPhotoIdx(null)} className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-white text-zinc-600 shadow-lg hover:bg-zinc-100">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
              {request.photos.length > 1 && (
                <div className="mt-3 flex justify-center gap-1.5">
                  {request.photos.map((_, i) => (
                    <button key={i} type="button" onClick={() => setPreviewPhotoIdx(i)} className={`size-1.5 rounded-full transition ${i === previewPhotoIdx ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
