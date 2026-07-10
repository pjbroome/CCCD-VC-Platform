"use client"

import { useEffect, useRef, useState } from "react"
import { uploadPhoto, photoUrl } from "@/lib/api"

const MAX_DIM = 2200 // downscale very large phone photos on save
const ZOOM_MIN = 1
const ZOOM_MAX = 5

/**
 * Staff photo viewer/editor: zoom + pan to inspect the smile, rotate
 * (persisted via Save orientation when onSaved is provided), and Download
 * (saves a full-resolution copy, rotation baked in, to the staff machine).
 * Rotation persistence re-encodes to JPEG via canvas and re-uploads; the
 * caller swaps the request's photo path so the corrected orientation shows
 * everywhere. Keys are trapped in capture phase so an open viewer never
 * advances presentation slides underneath it.
 */
export function PhotoEditor({
  photoPath,
  label,
  onSaved,
  onClose,
  onPrev,
  onNext,
  position,
}: {
  photoPath: string
  label?: string
  /** Omit to run as a read-only viewer (rotate/zoom/download, no persist). */
  onSaved?: (newPath: string) => void
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  /** e.g. "2 of 3" shown beside the title when browsing multiple photos */
  position?: string
}) {
  const [rotation, setRotation] = useState(0) // degrees clockwise
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const rotateBy = (d: number) => setRotation((r) => (((r + d) % 360) + 360) % 360)
  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
  const setZoomSafe = (z: number) => {
    const next = clampZoom(z)
    setZoom(next)
    if (next === 1) setOffset({ x: 0, y: 0 })
  }

  // Fresh photo = fresh view
  useEffect(() => { setRotation(0); resetView(); setErr(null) }, [photoPath])

  // Esc closes, arrows browse — captured so nothing underneath reacts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); if (!saving) onClose() }
      else if (e.key === "ArrowLeft" && onPrev) { e.stopPropagation(); e.preventDefault(); onPrev() }
      else if (e.key === "ArrowRight" && onNext) { e.stopPropagation(); e.preventDefault(); onNext() }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.stopPropagation() }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose, onPrev, onNext, saving])

  // Wheel zoom — attached manually so preventDefault works (React wheel is passive).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => {
        const next = clampZoom(z * (e.deltaY < 0 ? 1.12 : 0.89))
        if (next === 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    const limit = 600 * zoom
    setOffset({
      x: Math.max(-limit, Math.min(limit, drag.current.ox + dx)),
      y: Math.max(-limit, Math.min(limit, drag.current.oy + dy)),
    })
  }
  const onPointerUp = () => { drag.current = null }

  /** Fetch the original, bake the current rotation in at full resolution. */
  async function renderRotated(): Promise<Blob> {
    const res = await fetch(photoUrl(photoPath))
    if (!res.ok) throw new Error("fetch failed")
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    try {
      const rot = ((rotation % 360) + 360) % 360
      const swap = rot === 90 || rot === 270
      const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height))
      const w = Math.round(bmp.width * scale)
      const h = Math.round(bmp.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = swap ? h : w
      canvas.height = swap ? w : h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no canvas context")
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rot * Math.PI) / 180)
      ctx.drawImage(bmp, -w / 2, -h / 2, w, h)
      return await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9)
      )
    } finally {
      bmp.close()
    }
  }

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const out = await renderRotated()
      const file = new File([out], `edited_${Date.now()}.jpg`, { type: "image/jpeg" })
      const uploaded = await uploadPhoto(file)
      await onSaved?.(uploaded.url)
    } catch {
      setErr("Couldn't save the edit. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function download() {
    setDownloading(true)
    setErr(null)
    try {
      const out = await renderRotated()
      const url = URL.createObjectURL(out)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(label || "patient_photo").replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErr("Couldn't download the photo. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const iconBtn = "flex size-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 disabled:opacity-40"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4" onClick={() => { if (!saving) onClose() }}>
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--k-line)] px-5 py-3">
          <p className="text-sm font-semibold text-zinc-900">
            {label || "Photo"}
            {position && <span className="ml-2 font-normal text-zinc-400">{position}</span>}
          </p>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100" title="Close (Esc)">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div
          ref={stageRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-950"
          style={{ touchAction: "none", cursor: zoom > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoom > 1 ? resetView() : setZoomSafe(2.5))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(photoPath)}
            alt="Patient photo"
            className="max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})` }}
            draggable={false}
          />

          {onPrev && (
            <button onClick={onPrev} className={`${iconBtn} absolute left-3 top-1/2 -translate-y-1/2`} title="Previous photo (←)">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className={`${iconBtn} absolute right-3 top-1/2 -translate-y-1/2`} title="Next photo (→)">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          )}

          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {Math.round(zoom * 100)}%
          </span>
          {(zoom > 1 || offset.x !== 0 || offset.y !== 0) && (
            <button onClick={resetView} className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/70">
              Reset view
            </button>
          )}
        </div>

        <div className="space-y-2.5 px-5 py-3.5">
          {/* Compact icon bubbles, bottom-right under the photo: rotate ↺ ↻ · zoom − + */}
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={() => rotateBy(-90)} title="Rotate left" className="relative flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition after:absolute after:-inset-1 after:content-[''] hover:bg-zinc-200 hover:text-zinc-900">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
            </button>
            <button onClick={() => rotateBy(90)} title="Rotate right" className="relative flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition after:absolute after:-inset-1 after:content-[''] hover:bg-zinc-200 hover:text-zinc-900">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
            </button>
            <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden="true" />
            <button onClick={() => setZoomSafe(zoom / 1.25)} title="Zoom out" className="relative flex size-8 items-center justify-center rounded-full bg-zinc-100 text-base font-bold text-zinc-600 transition after:absolute after:-inset-1 after:content-[''] hover:bg-zinc-200 hover:text-zinc-900">−</button>
            <button onClick={() => setZoomSafe(zoom * 1.25)} title="Zoom in" className="relative flex size-8 items-center justify-center rounded-full bg-zinc-100 text-base font-bold text-zinc-600 transition after:absolute after:-inset-1 after:content-[''] hover:bg-zinc-200 hover:text-zinc-900">+</button>
          </div>

          {err && <p className="text-xs font-medium text-red-600">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={download}
              disabled={downloading}
              className="mr-auto inline-flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
              title="Save a copy to this device (current rotation applied)"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              {downloading ? "Preparing…" : "Download"}
            </button>
            <button onClick={onClose} disabled={saving} className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50">Close</button>
            {onSaved && (
              <button
                onClick={save}
                disabled={saving || rotation === 0}
                className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
                style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}
                title={rotation === 0 ? "Rotate the photo first" : "Save the new orientation for everyone"}
              >
                {saving ? "Saving…" : "Save orientation"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
