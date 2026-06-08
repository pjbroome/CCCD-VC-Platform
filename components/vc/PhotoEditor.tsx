"use client"

import { useState } from "react"
import { uploadPhoto, photoUrl } from "@/lib/api"

const MAX_DIM = 2200 // downscale very large phone photos on save

/**
 * Staff photo editor: rotate (persisted), zoom (view), and resize-on-save.
 * Rotation is baked into a re-encoded JPEG via canvas and re-uploaded, then the
 * caller swaps the request's photo path — so the corrected orientation shows
 * everywhere (dashboard, deck, patient view). No server-side image library.
 */
export function PhotoEditor({
  photoPath,
  label,
  onSaved,
  onClose,
}: {
  photoPath: string
  label?: string
  onSaved: (newPath: string) => void
  onClose: () => void
}) {
  const [rotation, setRotation] = useState(0) // degrees clockwise
  const [zoom, setZoom] = useState(1)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const rotateBy = (d: number) => setRotation((r) => (((r + d) % 360) + 360) % 360)

  async function save() {
    setSaving(true)
    setErr(null)
    let bmp: ImageBitmap | null = null
    try {
      const res = await fetch(photoUrl(photoPath))
      if (!res.ok) throw new Error("fetch failed")
      const blob = await res.blob()
      bmp = await createImageBitmap(blob)

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

      const out: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9)
      )
      const file = new File([out], `edited_${Date.now()}.jpg`, { type: "image/jpeg" })
      const uploaded = await uploadPhoto(file)
      await onSaved(uploaded.url)
    } catch {
      setErr("Couldn't save the edit. Please try again.")
    } finally {
      bmp?.close()
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!saving) onClose() }}>
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--k-line)] px-5 py-3">
          <p className="text-sm font-semibold text-zinc-900">Edit photo{label ? ` · ${label}` : ""}</p>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100" title="Close">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex items-center justify-center overflow-hidden bg-zinc-900/95 p-6" style={{ height: 420 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(photoPath)}
            alt="Editing"
            className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
            draggable={false}
          />
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => rotateBy(-90)} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
              Rotate left
            </button>
            <button onClick={() => rotateBy(90)} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
              Rotate right
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Zoom</span>
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-32 accent-[var(--k-accent)]" />
            </div>
          </div>

          {err && <p className="text-xs font-medium text-red-600">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} disabled={saving} className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50">Cancel</button>
            <button
              onClick={save}
              disabled={saving || rotation === 0}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
              style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}
              title={rotation === 0 ? "Rotate the photo first" : "Save the new orientation"}
            >
              {saving ? "Saving…" : "Save orientation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
