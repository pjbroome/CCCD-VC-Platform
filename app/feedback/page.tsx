"use client"

import { useEffect, useState } from "react"
import { submitFeedback, type FeedbackPayload } from "@/lib/api"

const GOLD = "#c4a052"

function Scale({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  max = 5,
  start = 1,
}: {
  label: string
  value?: number
  onChange: (n: number) => void
  lowLabel?: string
  highLabel?: string
  max?: number
  start?: number
}) {
  const nums = Array.from({ length: max - start + 1 }, (_, i) => i + start)
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-800">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {nums.map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="size-9 rounded-lg text-sm font-semibold transition sm:size-10"
              style={
                active
                  ? { background: GOLD, color: "#fff", boxShadow: `0 4px 12px -3px ${GOLD}99` }
                  : { background: "#fff", color: "#71717a", boxShadow: "inset 0 0 0 1px #e4e4e7" }
              }
            >
              {n}
            </button>
          )
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  )
}

function Choice({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-800">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className="rounded-full px-4 py-2 text-sm font-medium transition"
              style={active ? { background: GOLD, color: "#fff" } : { background: "#fff", color: "#52525b", boxShadow: "inset 0 0 0 1px #e4e4e7" }}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Text({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-800">{label}</p>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#c4a052]/50 focus:bg-white focus:ring-2 focus:ring-[#c4a052]/15"
      />
    </div>
  )
}

export default function FeedbackPage() {
  const [f, setF] = useState<FeedbackPayload>({})
  const [hp, setHp] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof FeedbackPayload, v: string | number) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (typeof navigator !== "undefined" && !f.device) {
      const m = /Mobi|Android|iPhone/i.test(navigator.userAgent)
      const t = /iPad|Tablet/i.test(navigator.userAgent)
      set("device", t ? "Tablet" : m ? "Mobile" : "Desktop")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await submitFeedback({ ...f, website: hp })
      setDone(true)
    } catch {
      setErr("Couldn't submit — please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#FBF9F3] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_24px_70px_-24px_rgba(120,100,40,0.25)] ring-1 ring-[#c4a052]/15">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full" style={{ background: `${GOLD}1a`, color: GOLD }}>
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Thank you!</h1>
          <p className="mt-2 text-sm text-zinc-500">Your feedback goes straight to Dr. Broome&apos;s team and genuinely shapes what we build next. We appreciate you testing it.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[#FBF9F3] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Charlotte Center for Cosmetic Dentistry</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">Virtual Consult — Tester Feedback</h1>
          <p className="mt-2 text-sm text-zinc-500">You just tried our new virtual consultation tool. Tell us how it felt — it takes about 60 seconds and there are no wrong answers.</p>
        </div>

        <div className="mt-6 space-y-6 rounded-3xl bg-white p-6 shadow-[0_20px_60px_-28px_rgba(120,100,40,0.25)] ring-1 ring-[#c4a052]/12 sm:p-7">
          {/* honeypot */}
          <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>

          <Choice label="Who are you?" value={f.role} onChange={(v) => set("role", v)} options={["Staff member", "Friend / family", "Patient", "Other"]} />
          <Choice label="What device did you use?" value={f.device} onChange={(v) => set("device", v)} options={["Mobile", "Desktop", "Tablet"]} />

          <div className="h-px bg-zinc-100" />

          <Scale label="Overall, how easy was it to use?" value={f.ease} onChange={(v) => set("ease", v)} lowLabel="Hard" highLabel="Very easy" />
          <Scale label="How easy was uploading your photos?" value={f.photo_ease} onChange={(v) => set("photo_ease", v)} lowLabel="Confusing" highLabel="Effortless" />
          <Scale label="Were the instructions clear?" value={f.clarity} onChange={(v) => set("clarity", v)} lowLabel="Unclear" highLabel="Crystal clear" />
          <Scale label="Did it look trustworthy and professional?" value={f.trust} onChange={(v) => set("trust", v)} lowLabel="Not really" highLabel="Absolutely" />

          <Choice label="Would you feel comfortable using this for a real consultation?" value={f.comfortable} onChange={(v) => set("comfortable", v)} options={["Yes", "Maybe", "No"]} />
          <Scale label="How likely are you to recommend this to a friend?" value={f.nps} onChange={(v) => set("nps", v)} max={10} start={0} lowLabel="Not likely" highLabel="Extremely" />

          <div className="h-px bg-zinc-100" />

          <Text label="What did you like most?" value={f.liked} onChange={(v) => set("liked", v)} placeholder="Anything that felt great…" />
          <Text label="Anything confusing or that didn't work?" value={f.confusing} onChange={(v) => set("confusing", v)} placeholder="Be honest — this is the most useful part." />
          <Text label="What would you add or change?" value={f.suggestions} onChange={(v) => set("suggestions", v)} placeholder="Your suggestions…" />

          <div className="grid grid-cols-2 gap-3">
            <input value={f.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Name (optional)" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-[#c4a052]/50 focus:bg-white focus:ring-2 focus:ring-[#c4a052]/15" />
            <input value={f.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="Email (optional)" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-[#c4a052]/50 focus:bg-white focus:ring-2 focus:ring-[#c4a052]/15" />
          </div>

          {err && <p className="text-sm font-medium text-red-600">{err}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-full px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-6px_rgba(196,160,82,0.5)] transition hover:brightness-105 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #d4b062)` }}
          >
            {busy ? "Sending…" : "Submit Feedback"}
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-zinc-400">Pre‑release tester feedback · Charlotte Center for Cosmetic Dentistry</p>
      </div>
    </main>
  )
}
