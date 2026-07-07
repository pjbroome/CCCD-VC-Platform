"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { uploadPhoto, createVCRequest } from "@/lib/api"
import { Turnstile, TURNSTILE_ENABLED } from "@/components/vc/Turnstile"
import type { TurnstileHandle } from "@/components/vc/Turnstile"
import type { PhotoUploadResponse, VCRequestPayload } from "@/lib/api"

const spring = { type: "spring" as const, stiffness: 100, damping: 20 }

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { ...spring } },
}

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  zip: string
  concern: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  zip?: string
  concern?: string
  photos?: string
  submit?: string
}

type SubmitState = "idle" | "uploading" | "submitting" | "success" | "error"

// Selectable concern chips — tapping is far easier than composing an answer
// from scratch, and the free-text box below stays available for nuance.
const CONCERN_CHIPS = [
  "Smile Upgrade",
  "Whiter smile",
  "Straighter teeth",
  "Fix a chip or gap",
  "Replace old crowns or veneers",
  "Other — I'll explain",
]

// A picked photo survives reloads: we keep a compressed preview + the
// background-uploaded server URL in sessionStorage. Original Files live only
// in memory (fileMap) and are preferred for uploads/rotation while available.
interface PhotoSlot {
  id: string
  name: string
  thumb: string // jpeg dataURL, <=1024px
  url?: string  // server URL once the background upload lands
}

const PHOTOS_KEY = "vc-photos-v1"
const SUBMITTED_KEY = "vc-submitted-v1"
const OTHER = "Other — I'll explain"

// The free-text answer flows into AI-assisted review downstream, so treat it
// as untrusted: hard length cap + strip control/invisible characters that
// pasted text could use to smuggle hidden instructions.
const CONCERN_MAX = 300
const sanitizeConcern = (raw: string) =>
  raw
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "")
    .slice(0, CONCERN_MAX)

const dataURLtoFile = (dataUrl: string, name: string): File => {
  const [head, body] = dataUrl.split(",")
  const mime = head.match(/data:(.*?);/)?.[1] || "image/jpeg"
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], name, { type: mime })
}

const downscaleToDataURL = async (file: File | Blob, maxDim = 1024, quality = 0.82): Promise<string> => {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const c = document.createElement("canvas")
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c.toDataURL("image/jpeg", quality)
}

const rotateImage = async (src: File | Blob): Promise<Blob> => {
  const bmp = await createImageBitmap(src)
  const c = document.createElement("canvas")
  c.width = bmp.height
  c.height = bmp.width
  const ctx = c.getContext("2d")!
  ctx.translate(c.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const zipDigits = (v: string) => v.replace(/\D/g, "").slice(0, 9)
// 12345 or 12345-6789, dash auto-inserted
const formatZip = (raw: string) => {
  const d = zipDigits(raw)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
const zipLengthOk = (v: string) => {
  const n = zipDigits(v).length
  return n === 5 || n === 9
}

const phoneDigits = (v: string) => {
  let d = v.replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1) // pasted +1 numbers
  return d.slice(0, 10)
}

// Live-format as (704) 555-1234. The format never ends in a symbol, so
// backspace always removes a real digit — no special deletion handling needed.
const formatPhone = (raw: string): string => format10(phoneDigits(raw))

const format10 = (d: string): string => {
  if (d.length === 0) return ""
  if (d.length < 4) return `(${d}`
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// Palette: deep emerald primary + ivory atmosphere; gold demoted to a single
// hairline accent so the page reads refined rather than gilded.
const EMERALD = "#047857"
const EMERALD_LIGHT = "#10b981"

export function VCIntake() {
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    zip: "",
    concern: "",
  })
  // "Smile Upgrade" pre-selected: the flagship wish, and a smart default the
  // patient can tap off — the form starts with one answer already given.
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>(["Smile Upgrade"])
  const [fullFace, setFullFace] = useState<PhotoSlot | null>(null)
  const [closeUp, setCloseUp] = useState<PhotoSlot | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [honeypot, setHoneypot] = useState("") // bot trap — must stay empty for real users
  const [sourceUrl, setSourceUrl] = useState("")
  const [extras, setExtras] = useState<PhotoSlot[]>([])
  // Real-ZIP check via the free Zippopotam lookup. Fails OPEN on network
  // problems — a directory outage must never block a patient.
  const [zipInfo, setZipInfo] = useState<{ zip5: string; status: "valid" | "invalid" | "unknown"; place?: string }>({ zip5: "", status: "unknown" })
  const prefersReducedMotion = useReducedMotion()
  // The optional note stays behind a small pill (no empty boxes on screen);
  // picking "Other" opens it automatically since a note is then required.
  const [noteOpen, setNoteOpen] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const showNote = noteOpen || selectedConcerns.includes(OTHER) || form.concern.trim().length > 0
  useEffect(() => {
    if (selectedConcerns.includes(OTHER)) noteRef.current?.focus({ preventScroll: true })
  }, [selectedConcerns])

  // Turnstile tokens expire after ~5 min — longer than a careful patient takes to
  // fill this form. Track the latest token + its age in refs so we can mint a
  // fresh one at submit time instead of sending a stale token (which the backend
  // rejects as "Bot verification failed" even though every field is valid).
  const turnstileRef = useRef<TurnstileHandle | null>(null)
  const tokenRef = useRef("")
  const tokenIssuedAt = useRef(0)
  const handleTurnstileToken = useCallback((t: string) => {
    tokenRef.current = t
    tokenIssuedAt.current = t ? Date.now() : 0
  }, [])

  const TOKEN_MAX_AGE_MS = 240_000
  const TOKEN_WAIT_MS = 20_000

  const freshTurnstileToken = async (forceReset = false): Promise<string> => {
    if (!TURNSTILE_ENABLED) return ""
    const isFresh = tokenRef.current && Date.now() - tokenIssuedAt.current < TOKEN_MAX_AGE_MS
    if (isFresh && !forceReset) return tokenRef.current
    tokenRef.current = ""
    turnstileRef.current?.reset()
    // Wait for the widget callback — instant when Cloudflare auto-passes. If it
    // decides to show an interactive check, bring it on screen so the visitor
    // actually sees what it's waiting for.
    turnstileAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    const deadline = Date.now() + TOKEN_WAIT_MS
    while (Date.now() < deadline) {
      if (tokenRef.current) return tokenRef.current
      await new Promise((r) => setTimeout(r, 250))
    }
    return ""
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const params = new URLSearchParams(window.location.search)
      const utm = params.get("utm_source") || params.get("source")
      const ref = document.referrer || window.location.href
      setSourceUrl(utm ? `${utm} (${ref})` : ref)
    } catch {
      /* ignore */
    }
  }, [])


  const formRef = useRef<HTMLDivElement>(null)
  const extrasInputRef = useRef<HTMLInputElement>(null)
  const turnstileAnchorRef = useRef<HTMLDivElement>(null)

  // Photos start uploading the moment they are picked; slots carry the server
  // URL forward so submits are instant and reloads lose nothing.
  const fileMap = useRef(new Map<string, File>())
  const uploadJobs = useRef(new Map<string, Promise<string>>())

  const applyUrl = useCallback((id: string, url: string) => {
    const patch = (sl: PhotoSlot | null) => (sl && sl.id === id ? { ...sl, url } : sl)
    setFullFace(patch)
    setCloseUp(patch)
    setExtras((prev) => prev.map((sl) => (sl.id === id ? { ...sl, url } : sl)))
  }, [])

  const ensureUploaded = useCallback((slot: PhotoSlot): Promise<string> => {
    if (slot.url) return Promise.resolve(slot.url)
    const cached = uploadJobs.current.get(slot.id)
    if (cached) return cached
    const src = fileMap.current.get(slot.id) ?? dataURLtoFile(slot.thumb, slot.name)
    const job = uploadPhoto(src).then((r: PhotoUploadResponse) => {
      applyUrl(slot.id, r.url)
      return r.url
    })
    job.catch(() => uploadJobs.current.delete(slot.id))
    uploadJobs.current.set(slot.id, job)
    return job
  }, [applyUrl])

  const makeSlot = useCallback(async (f: File): Promise<PhotoSlot> => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const thumb = await downscaleToDataURL(f)
    fileMap.current.set(id, f)
    const slot: PhotoSlot = { id, name: f.name, thumb }
    void ensureUploaded(slot).catch(() => {})
    return slot
  }, [ensureUploaded])

  const rotateSlot = useCallback(async (slot: PhotoSlot, apply: (next: PhotoSlot) => void) => {
    const src = fileMap.current.get(slot.id) ?? dataURLtoFile(slot.thumb, slot.name)
    const rotated = await rotateImage(src)
    const f = new File([rotated], slot.name, { type: "image/jpeg" })
    fileMap.current.set(slot.id, f)
    uploadJobs.current.delete(slot.id)
    const thumb = await downscaleToDataURL(f)
    const next: PhotoSlot = { ...slot, thumb, url: undefined }
    apply(next)
    void ensureUploaded(next).catch(() => {})
  }, [ensureUploaded])

  // Hydrate photos + the submitted lock after mount (SSR-safe).
  useEffect(() => {
    try {
      const sub = sessionStorage.getItem(SUBMITTED_KEY)
      if (sub) {
        const d = JSON.parse(sub)
        setForm((prev) => ({ ...prev, firstName: d.firstName || "", email: d.email || "" }))
        setSubmitState("success")
        return
      }
      const saved = sessionStorage.getItem(PHOTOS_KEY)
      if (saved) {
        const d = JSON.parse(saved)
        if (d.fullFace) setFullFace(d.fullFace)
        if (d.closeUp) setCloseUp(d.closeUp)
        if (Array.isArray(d.extras)) setExtras(d.extras)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist photo slots (thumbs + urls) so a reload or nav-away keeps them.
  useEffect(() => {
    try {
      if (fullFace || closeUp || extras.length) {
        sessionStorage.setItem(PHOTOS_KEY, JSON.stringify({ fullFace, closeUp, extras }))
      } else {
        sessionStorage.removeItem(PHOTOS_KEY)
      }
    } catch { /* storage full or blocked — previews just will not survive reload */ }
  }, [fullFace, closeUp, extras])

  const zip5 = zipDigits(form.zip).slice(0, 5)
  useEffect(() => {
    if (zip5.length !== 5 || zip5 === zipInfo.zip5) return
    const abort = new AbortController()
    const timer = setTimeout(async () => {
      const kill = setTimeout(() => abort.abort(), 3500)
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip5}`, { signal: abort.signal })
        clearTimeout(kill)
        if (res.status === 404) {
          setZipInfo({ zip5, status: "invalid" })
        } else if (res.ok) {
          const data = await res.json()
          const pl = data?.places?.[0]
          const place = pl ? `${pl["place name"]}, ${pl["state abbreviation"]}` : undefined
          setZipInfo({ zip5, status: "valid", place })
        } else {
          setZipInfo({ zip5, status: "unknown" })
        }
      } catch {
        clearTimeout(kill)
        setZipInfo({ zip5, status: "unknown" })
      }
    }, 350)
    return () => { clearTimeout(timer); abort.abort() }
  }, [zip5, zipInfo.zip5])

  const zipRejected = zipInfo.status === "invalid" && zipInfo.zip5 === zip5
  const zipConfirmed = zipInfo.status === "valid" && zipInfo.zip5 === zip5 ? zipInfo.place : undefined

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      if (errors[key as keyof FormErrors]) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[key as keyof FormErrors]
          return next
        })
      }
    },
    [errors]
  )

  const toggleConcern = useCallback((chip: string) => {
    setSelectedConcerns((prev) => {
      if (prev.includes(chip)) return prev.filter((c) => c !== chip)
      // "Other" stands alone: it clears the others, and picking any
      // specific wish clears "Other".
      if (chip === OTHER) return [OTHER]
      return [...prev.filter((c) => c !== OTHER), chip]
    })
    setErrors((prev) => {
      if (!prev.concern) return prev
      const next = { ...prev }
      delete next.concern
      return next
    })
  }, [])

  const otherNeedsDetail = selectedConcerns.includes(OTHER) && form.concern.trim().length === 0
  const concernSatisfied = (selectedConcerns.length > 0 || form.concern.trim().length > 0) && !otherNeedsDetail

  // Goal-gradient progress: arriving counts as the first step, so the meter
  // never reads zero. Seven milestones fill the remaining 80%.
  const milestones = [
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0,
    EMAIL_RE.test(form.email),
    phoneDigits(form.phone).length === 10,
    zipLengthOk(form.zip) && !zipRejected,
    concernSatisfied,
    !!fullFace,
    !!closeUp,
  ]
  const completed = milestones.filter(Boolean).length
  const progressPct = Math.round(20 + (completed / milestones.length) * 80)

  const infoDone = milestones[0] && milestones[1] && milestones[2] && milestones[3]
  const photosDone = !!fullFace && !!closeUp
  // The label counts the 3 promised steps (header says "3 easy steps"),
  // while the bar itself fills per field for smoother goal-gradient feedback.
  const stepsLeft = [infoDone, concernSatisfied, photosDone].filter((done) => !done).length
  const progressLabel =
    stepsLeft === 0 ? "Ready to send" : stepsLeft === 1 ? "1 step left" : `${stepsLeft} steps left`

  const validate = (): FormErrors => {
    const e: FormErrors = {}
    if (!form.firstName.trim()) e.firstName = "First name is required"
    if (!form.lastName.trim()) e.lastName = "Last name is required"
    if (!form.email.trim()) {
      e.email = "Email is required"
    } else if (!EMAIL_RE.test(form.email)) {
      e.email = "Please enter a valid email"
    }
    if (!form.phone.trim()) {
      e.phone = "Phone number is required"
    } else if (phoneDigits(form.phone).length !== 10) {
      e.phone = "Enter a 10-digit phone number"
    }
    if (!form.zip.trim()) {
      e.zip = "Zip code is required"
    } else if (!zipLengthOk(form.zip)) {
      e.zip = "Enter a 5-digit zip code (or ZIP+4)"
    } else if (zipRejected) {
      e.zip = "That zip code doesn't match a real US location"
    }
    if (otherNeedsDetail) {
      e.concern = "Tell us a little about what you'd like to change"
    } else if (!concernSatisfied) {
      e.concern = "Tap what you'd like to change — or tell us in your own words"
    }
    if (!fullFace) e.photos = "A full-face selfie is required"
    else if (!closeUp) e.photos = "A close-up smile photo is required"
    return e
  }

  const handleSubmit = async () => {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      // Bring the first problem on screen — a tap that visibly does nothing
      // reads as "the form is broken".
      const order = ["firstName", "lastName", "email", "phone", "zip", "concern", "photos"] as const
      const firstKey = order.find((k) => k in validationErrors)
      const targetId = firstKey === "concern" ? "vc-step-2" : firstKey === "photos" ? "vc-step-3" : `vc-field-${firstKey}`
      const target = document.getElementById(targetId)
      target?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" })
      target?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true })
      return
    }

    setErrors({})

    try {
      setSubmitState("uploading")
      const slots = [fullFace, closeUp, ...extras.slice(0, 4)].filter((x): x is PhotoSlot => !!x)

      // Everything at once: photos (usually already uploaded in the background
      // when they were picked) and the bot-check token in parallel.
      const [photoUrls, token] = await Promise.all([
        Promise.all(slots.map((sl) => ensureUploaded(sl))),
        freshTurnstileToken(),
      ])

      setSubmitState("submitting")
      if (TURNSTILE_ENABLED && !token) {
        const st = turnstileRef.current?.getStatus()
        console.error("Turnstile diagnostic:", st)
        let msg = "Our security check could not complete. Please refresh the page and try again — your photos are saved."
        if (st?.lastError?.startsWith("110200")) {
          msg = "This page address is not authorized for our security check. Please open the form from the official link and try again — your photos are saved."
        } else if (!st?.scriptLoaded) {
          msg = "An ad-blocker or privacy filter is blocking our security check. Please pause it for this page (or try another browser), then press Submit again — your photos are saved."
        } else if (st?.rendered && !st?.lastError) {
          msg = "Please complete the quick security check just above the Submit button, then press Submit again."
        } else if (st?.lastError) {
          msg = `Our security check hit a snag (code ${st.lastError}). Please refresh and try again — your photos are saved.`
        }
        setErrors({ submit: msg })
        setSubmitState("error")
        return
      }

      // Chips + free text combine into the single concern field the backend expects.
      const concernText = [selectedConcerns.join(" · "), sanitizeConcern(form.concern).trim()]
        .filter(Boolean)
        .join(" — ")

      const payload: VCRequestPayload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        date_of_birth: null,
        // No dedicated ZIP column on the backend yet — store zip (+ resolved city) in the location field.
        city: (zipConfirmed ? `${form.zip.trim()} — ${zipConfirmed}` : form.zip.trim()) || null,
        state: null,
        concern: concernText,
        // Consent statement removed from the form (per staff feedback); contract still expects a boolean.
        consent_acknowledged: true,
        photos: photoUrls,
        source_url: sourceUrl || undefined,
        website: honeypot,
        turnstile_token: token || undefined,
      }

      let response
      try {
        response = await createVCRequest(payload)
      } catch (err) {
        // A token can still go stale in transit — retry exactly once with a
        // forced-fresh token before surfacing an error to the patient.
        const isBotRejection = err instanceof Error && /bot verification/i.test(err.message)
        if (!TURNSTILE_ENABLED || !isBotRejection) throw err
        const retryToken = await freshTurnstileToken(true)
        if (!retryToken) throw err
        response = await createVCRequest({ ...payload, turnstile_token: retryToken })
      }

      // One submission per browser session — locks the form behind the
      // thank-you screen even after a reload.
      try {
        sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify({ firstName: form.firstName.trim(), email: form.email.trim() }))
        sessionStorage.removeItem(PHOTOS_KEY)
      } catch { /* ignore */ }
      setSubmitState("success")
    } catch (err) {
      console.error("Submission error:", err)
      setErrors({
        submit:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      })
      setSubmitState("error")
    }
  }

  const isSubmitting = submitState === "uploading" || submitState === "submitting"

  if (submitState === "success") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f5f0] px-4 py-8 [background-image:radial-gradient(ellipse_50%_35%_at_20%_0%,rgba(196,160,82,0.06),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(196,160,82,0.08),transparent)]">
        <motion.div
          className="mx-auto w-full max-w-md text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
        >
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="size-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Consultation Submitted!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            {"Thank you" + (form.firstName ? `, ${form.firstName}` : "") + "! Your consultation request has been received. Dr. Broome will review your photos and send a personalized video reply within 24 hours."}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {"We’ll send your reply to "}
            <span className="font-medium text-zinc-600">{form.email}</span>
          </p>
          <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <svg className="size-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900">What happens next?</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {"Dr. Broome will personally review your photos and record a video just for you — with his thoughts on your smile and the options that fit. Watch your inbox within 24 hours."}
                </p>
              </div>
            </div>
          </div>
          <a
            href="/feedback"
            className="mt-3 block text-xs font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-emerald-700"
          >
            Testing for us? Take the 60‑second feedback survey →
          </a>
        </motion.div>
        <p className="mt-8 text-center text-[11px] text-zinc-600">
          {"Dr. Patrick Broome · Charlotte, NC"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f5f0] px-4 py-6 [background-image:radial-gradient(ellipse_50%_35%_at_20%_0%,rgba(196,160,82,0.06),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(196,160,82,0.08),transparent)] sm:px-6 sm:py-8">
      <motion.div
        className="mx-auto flex w-full max-w-lg flex-1 flex-col"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header — minimal: title, gold hairline, one line */}
        <motion.div variants={fadeIn} className="mb-7 text-center sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tighter text-zinc-900 sm:text-3xl">
            Virtual Consultation
          </h1>
          <div className="mx-auto mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-[#c4a052] to-[#d4b062]" />
          <p className="mx-auto mt-2.5 max-w-sm text-xs leading-relaxed text-zinc-500 sm:text-sm">
            {"3 easy steps"}
          </p>
        </motion.div>

        {/* Progress — arriving counts as the first step, so it never reads 0%.
            The fill reveals a fixed ink→gold→emerald spectrum (counter-scale keeps
            it from squishing): the bar literally reaches GO-green as you finish. */}
        <motion.div variants={fadeIn} className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[11px]">
              Your consultation
            </span>
            <span className={`text-[11px] font-semibold transition-colors duration-500 sm:text-xs ${stepsLeft === 0 ? "text-emerald-700" : "text-zinc-700"}`}>
              {progressPct}% · {progressLabel}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Consultation request progress"
            className={`h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-shadow duration-700 ${stepsLeft === 0 ? "shadow-[inset_0_1px_2px_rgba(0,0,0,0.06),0_0_14px_-2px_rgba(4,120,87,0.55)]" : ""}`}
          >
            <div
              className="h-full origin-left overflow-hidden rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${progressPct / 100})` }}
            >
              <div
                className="relative h-full w-full origin-left transition-transform duration-700 ease-out motion-reduce:transition-none"
                style={{
                  transform: `scaleX(${100 / progressPct})`,
                  background: "linear-gradient(90deg, #27272a 0%, #6b5a35 22%, #c4a052 40%, #e6c87a 55%, #34b389 78%, #047857 100%)",
                }}
              >
                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(90deg, transparent 42%, rgba(255,255,255,0.35) 50%, transparent 58%)" }}
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Honeypot — hidden from humans; bots fill it and are silently dropped. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
          <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
        </div>

        {/* Global submit error */}
        <AnimatePresence>
          {errors.submit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {errors.submit}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={formRef} className="flex flex-1 flex-col gap-5 sm:gap-6">
          {/* Card 1 — details */}
          <motion.section variants={fadeIn} className="rounded-2xl bg-white p-5 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-7">
            <p className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <StepBadge n={1} done={infoDone} /> Step 1
            </p>
            <h2 className="mb-3 mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">Your details</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <InputField id="vc-field-firstName" label="First Name" placeholder="First" value={form.firstName} onChange={(v) => updateField("firstName", v)} error={errors.firstName} required autoComplete="given-name" />
              <InputField id="vc-field-lastName" label="Last Name" placeholder="Last" value={form.lastName} onChange={(v) => updateField("lastName", v)} error={errors.lastName} required autoComplete="family-name" />
            </div>
            <div className="mt-2.5 sm:mt-3">
              <InputField id="vc-field-email" label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={(v) => updateField("email", v)} error={errors.email} required autoComplete="email" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-3 sm:gap-3">
              <InputField id="vc-field-phone" label="Mobile Phone" type="tel" inputMode="tel" maxLength={14} placeholder="(704) 555-1234" value={form.phone} onChange={(v) => updateField("phone", formatPhone(v))} error={errors.phone} required autoComplete="tel" />
              <div>
                <InputField id="vc-field-zip" label="Zip Code" type="text" inputMode="numeric" maxLength={10} placeholder="28211" value={form.zip} onChange={(v) => updateField("zip", formatZip(v))} error={errors.zip} required autoComplete="postal-code" />
                {zipConfirmed && !errors.zip && (
                  <p className="mt-0.5 text-xs font-medium text-zinc-500">{zipConfirmed}</p>
                )}
              </div>
            </div>
          </motion.section>

          {/* Card 2 — goals */}
          <motion.section id="vc-step-2" variants={fadeIn} className="rounded-2xl bg-white p-5 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-7">
            <p className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <StepBadge n={2} done={concernSatisfied} /> Step 2
            </p>
            <h2 className="mb-3 mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">What would you love to change?</h2>
            {errors.concern && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-1.5 text-xs text-red-600">{errors.concern}</motion.p>}
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              {CONCERN_CHIPS.map((chip) => {
                const selected = selectedConcerns.includes(chip)
                return (
                  <motion.button
                    key={chip}
                    type="button"
                    onClick={() => toggleConcern(chip)}
                    aria-pressed={selected}
                    whileTap={{ scale: 0.95 }}
                    className={`flex min-h-11 w-full items-center justify-center rounded-full border px-3 py-2 text-center text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 sm:text-xs ${
                      selected
                        ? "border-[#c4a052]/70 bg-gradient-to-b from-zinc-700/95 via-zinc-900 to-[#26211a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.30),inset_0_-1px_0_rgba(196,160,82,0.35),0_6px_18px_-6px_rgba(38,33,26,0.55)] backdrop-blur-md"
                        : "border-zinc-300 bg-white text-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_2px_6px_-2px_rgba(0,0,0,0.08)] hover:border-zinc-500 hover:text-zinc-900 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.18)]"
                    }`}
                  >
                    {selected && <span className="mr-1 text-[#e6c87a]">✓</span>}
                    {chip}
                  </motion.button>
                )
              })}
            </div>
            {!showNote ? (
              <button
                type="button"
                onClick={() => { setNoteOpen(true); setTimeout(() => noteRef.current?.focus(), 50) }}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium text-zinc-700 transition-colors duration-200 hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:scale-95 sm:text-xs"
              >
                <span className="text-base leading-none">+</span>
                Add a note
                <span className="font-normal text-zinc-400">· optional</span>
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                <textarea
                  ref={noteRef}
                  value={form.concern}
                  onChange={(e) => updateField("concern", sanitizeConcern(e.target.value))}
                  placeholder="Tell us more"
                  maxLength={CONCERN_MAX}
                  className={`w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-base leading-relaxed text-zinc-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.07)] transition-all duration-300 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 sm:px-4 sm:py-3 sm:text-sm ${errors.concern ? "border-red-300 ring-1 ring-red-200" : "border-zinc-400"}`}
                  rows={2}
                />
                {form.concern.length >= CONCERN_MAX - 60 && (
                  <p className="mt-1 text-right text-xs text-zinc-500">{CONCERN_MAX - form.concern.length} characters left</p>
                )}
              </motion.div>
            )}
          </motion.section>

          {/* Card 3 — photos */}
          <motion.section id="vc-step-3" variants={fadeIn} className="rounded-2xl bg-white p-5 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-7">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <StepBadge n={3} done={photosDone} /> Step 3
              </p>
              {/* Answers the "where do these photos go?" objection right where it forms */}
              <span className="text-right text-[11px] font-medium leading-tight text-zinc-500">Private — for your consultation only</span>
            </div>
            <h2 className="mb-3 mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">Add your photos</h2>
            {errors.photos && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-2 text-xs text-red-600">{errors.photos}</motion.p>}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <UploadCard
                label="Full Face Selfie"
                variant="face"
                slot={fullFace}
                onRotate={() => { if (fullFace) void rotateSlot(fullFace, setFullFace) }}
                onFile={(f) => { if (!f) return; if (f.size > 14 * 1024 * 1024) { setErrors((prev) => ({ ...prev, photos: "That image is too large (max 14MB). Please choose a smaller photo." })); return } void makeSlot(f).then(setFullFace); if (errors.photos) setErrors((prev) => { const next = { ...prev }; delete next.photos; return next }) }}
              />
              <UploadCard
                label="Close-up Smile"
                variant="smile"
                slot={closeUp}
                onRotate={() => { if (closeUp) void rotateSlot(closeUp, setCloseUp) }}
                onFile={(f) => { if (!f) return; if (f.size > 14 * 1024 * 1024) { setErrors((prev) => ({ ...prev, photos: "That image is too large (max 14MB). Please choose a smaller photo." })); return } void makeSlot(f).then(setCloseUp); if (errors.photos) setErrors((prev) => { const next = { ...prev }; delete next.photos; return next }) }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {extras.map((sl) => (
                <div key={sl.id} className="relative size-16 rounded-lg border border-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sl.thumb} alt="" className="size-full rounded-lg object-cover" />
                  {/* after:-inset extends the tap area to ~44px without growing the glyph */}
                  <button type="button" aria-label="Remove photo" onClick={() => setExtras((p) => p.filter((x) => x.id !== sl.id))} className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white after:absolute after:-inset-2.5 after:content-['']">×</button>
                </div>
              ))}
              {extras.length < 4 && (
                <button
                  type="button"
                  onClick={() => extrasInputRef.current?.click()}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium text-zinc-700 transition-colors duration-200 hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 sm:text-xs"
                >
                  <span className="text-base leading-none">+</span>
                  Add
                  <span className="font-normal text-zinc-400">· optional</span>
                </button>
              )}
              <input ref={extrasInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                const all = Array.from(e.target.files || [])
                const ok = all.filter((f) => f.size <= 14 * 1024 * 1024)
                if (ok.length < all.length) setErrors((prev) => ({ ...prev, photos: "Some images were too large (max 14MB each) and were skipped." }))
                void Promise.all(ok.map(makeSlot)).then((slots) => setExtras((p) => [...p, ...slots].slice(0, 4)))
                e.currentTarget.value = ""
              }} />
            </div>
          </motion.section>

          {/* Submit */}
          <motion.div variants={fadeIn}>
            {/* Bot challenge — renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set */}
            <div ref={turnstileAnchorRef}>
              <Turnstile ref={turnstileRef} onToken={handleTurnstileToken} />
            </div>

            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mx-auto mt-1 flex items-center justify-center gap-2 rounded-2xl px-12 py-4 text-lg font-semibold text-white shadow-[0_6px_24px_-6px_rgba(4,120,87,0.5)] transition-all duration-200 hover:shadow-[0_8px_28px_-6px_rgba(4,120,87,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundImage: `linear-gradient(to right, ${EMERALD}, ${EMERALD_LIGHT})` }}
              whileTap={isSubmitting ? {} : { scale: 0.98 }}
              transition={spring}
            >
              {isSubmitting ? (
                <>
                  <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {submitState === "uploading" ? "Sending your photos..." : "Almost done..."}
                </>
              ) : (
                "Submit"
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          variants={fadeIn}
          className="mt-5 text-center text-[11px] text-zinc-600"
        >
          {"Dr. Patrick Broome · Charlotte, NC"}
        </motion.p>
      </motion.div>
    </div>
  )
}

/* Reusable sub-components */

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  if (done) {
    return (
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-[#c4a052]/70 bg-gradient-to-b from-zinc-600 via-zinc-900 to-[#26211a] text-[#e6c87a] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(196,160,82,0.4),0_3px_8px_-2px_rgba(38,33,26,0.5)] sm:size-6"
      >
        <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.span>
    )
  }
  return (
    <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-[#c4a052]/70 bg-gradient-to-b from-zinc-600 via-zinc-900 to-[#26211a] text-[10px] font-bold text-[#f0dfae] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(196,160,82,0.4),0_3px_8px_-2px_rgba(38,33,26,0.5)] sm:size-6 sm:text-[11px]">
      {n}
    </span>
  )
}

function InputField({
  id, label, value, onChange, error, type = "text", required, autoComplete, inputMode, maxLength, placeholder,
}: {
  id?: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  required?: boolean
  autoComplete?: string
  inputMode?: "text" | "numeric" | "tel" | "email" | "url" | "search" | "none" | "decimal"
  maxLength?: number
  placeholder?: string
}) {
  return (
    <div id={id}>
      <label className="mb-1 block text-xs font-medium text-zinc-600">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {/* text-base on mobile: 16px is the threshold below which iOS Safari auto-zooms on focus */}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-white px-3 py-3 text-base text-zinc-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.07)] transition-all placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 sm:py-2.5 sm:text-sm ${error ? "border-red-300 ring-1 ring-red-200" : "border-zinc-400"}`}
      />
      {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-xs text-red-600">{error}</motion.p>}
    </div>
  )
}

function FaceSketch() {
  return (
    <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="fsHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a32" /><stop offset="1" stopColor="#4a2f1d" />
        </linearGradient>
        <linearGradient id="fsSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9dfc4" /><stop offset="1" stopColor="#f0c8a4" />
        </linearGradient>
        <linearGradient id="fsTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfbf6" /><stop offset="1" stopColor="#ece4d2" />
        </linearGradient>
      </defs>
      {/* gold viewfinder brackets */}
      <g stroke="#c4a052" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M14 26 V14 H26" /><path d="M134 14 H146 V26" />
        <path d="M146 84 V96 H134" /><path d="M26 96 H14 V84" />
      </g>
      {/* soft ground shadow */}
      <ellipse cx="80" cy="102" rx="30" ry="4" fill="#d9d2c2" opacity="0.5" />
      {/* shoulders / top */}
      <path d="M46 104 C52 86 64 82 80 82 C96 82 108 86 114 104 Z" fill="url(#fsTop)" stroke="#d3c9b4" strokeWidth="1.5" />
      {/* neck */}
      <path d="M72 70 H88 V84 C88 89 72 89 72 84 Z" fill="url(#fsSkin)" />
      {/* face */}
      <ellipse cx="80" cy="50" rx="23" ry="26" fill="url(#fsSkin)" />
      {/* hair sweep */}
      <path d="M55 52 C52 24 74 18 84 19 C102 20 108 34 105 52 C104 42 100 36 96 35 C90 33 88 38 80 37 C70 36 62 40 60 46 C58 50 56 52 55 52 Z" fill="url(#fsHair)" />
      {/* happy closed eyes */}
      <g stroke="#5b4232" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M66 51 Q70 47 74 51" /><path d="M86 51 Q90 47 94 51" />
      </g>
      {/* brows */}
      <g stroke="#6b4a32" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M65 44 Q70 41.5 75 44" /><path d="M85 44 Q90 41.5 95 44" />
      </g>
      {/* blush */}
      <circle cx="66" cy="59" r="3.4" fill="#f2a58d" opacity="0.5" />
      <circle cx="94" cy="59" r="3.4" fill="#f2a58d" opacity="0.5" />
      {/* warm smile with teeth hint */}
      <path d="M70 62 Q80 71 90 62 Q85 69.5 80 69.5 Q75 69.5 70 62 Z" fill="#ffffff" stroke="#c26a5a" strokeWidth="1.8" strokeLinejoin="round" />
      {/* gold earring */}
      <circle cx="57" cy="58" r="1.8" fill="#c4a052" />
      {/* sparkles */}
      <path d="M122 28 l2.8 6.8 6.8 2.8 -6.8 2.8 -2.8 6.8 -2.8 -6.8 -6.8 -2.8 6.8 -2.8 Z" fill="#c4a052" />
      <path d="M36 40 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 Z" fill="#e2cd9b" />
    </svg>
  )
}

function SmileSketch() {
  return (
    <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="ssLips" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0596b" /><stop offset="1" stopColor="#b93a52" />
        </linearGradient>
        <linearGradient id="ssTeethArc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f2f4f6" />
        </linearGradient>
      </defs>
      <g stroke="#c4a052" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M14 26 V14 H26" /><path d="M134 14 H146 V26" />
        <path d="M146 84 V96 H134" /><path d="M26 96 H14 V84" />
      </g>
      {/* outer lips */}
      <path d="M44 48 Q80 36 116 48 Q108 84 80 86 Q52 84 44 48 Z" fill="url(#ssLips)" />
      {/* upper lip highlight */}
      <path d="M56 44 Q80 37.5 104 44 Q92 40.5 80 41.5 Q68 40.5 56 44 Z" fill="#ffffff" opacity="0.35" />
      {/* mouth interior */}
      <path d="M50 50 Q80 44 110 50 Q103 78 80 80 Q57 78 50 50 Z" fill="#7e2438" />
      {/* upper teeth — incisal edge curves DOWN with the lower lip (ideal smile arc, centrals longest) */}
      <path d="M53 51 Q80 45.5 107 51 L104 57.5 Q80 70 56 57.5 Z" fill="url(#ssTeethArc)" />
      {/* tooth separators, following the arc */}
      <g stroke="#c9ced4" strokeWidth="1.3" strokeLinecap="round">
        <path d="M63 48.6 L64.5 60.8" /><path d="M72 47.3 L72.5 64.4" /><path d="M88 47.3 L87.5 64.4" /><path d="M97 48.6 L95.5 60.8" />
      </g>
      {/* faint lower-teeth sliver near the corners only (true smiles show mostly upper teeth) */}
      <path d="M62 73 Q80 76.5 98 73 Q90 77.5 80 77.8 Q70 77.5 62 73 Z" fill="#e8ebee" opacity="0.55" />
      {/* gleam ting on the central incisor */}
      <path d="M72 41 l2.6 6.2 6.2 2.6 -6.2 2.6 -2.6 6.2 -2.6 -6.2 -6.2 -2.6 6.2 -2.6 Z" fill="#c4a052" />
      <g stroke="#e2cd9b" strokeWidth="1.6" strokeLinecap="round">
        <path d="M118 34 L124 28" /><path d="M121 40 L128 38" />
      </g>
    </svg>
  )
}

function UploadCard({
  label, variant, slot, onFile, onRotate,
}: {
  label: string
  variant: "face" | "smile"
  slot: PhotoSlot | null
  onFile: (f: File | null) => void
  onRotate: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (slot) {
    return (
      <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 text-center sm:rounded-2xl">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 cursor-pointer"
          aria-label={`${label} — tap to change`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img key={slot.thumb} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }} src={slot.thumb} alt={`${label} preview`} className="size-full object-cover" />
        </button>
        {/* check badge — the reward beat lands just after the photo settles */}
        <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.1 }} className="pointer-events-none absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-zinc-900/85 shadow-sm ring-1 ring-white/25 backdrop-blur">
          <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.span>
        {/* rotate */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRotate() }}
          aria-label={`Rotate ${label}`}
          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-zinc-900/85 text-white shadow-sm ring-1 ring-white/25 backdrop-blur transition-transform duration-200 after:absolute after:-inset-2.5 after:content-[''] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
        {/* bottom label */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left">
          <span className="truncate text-[11px] font-semibold text-white sm:text-xs">{label}</span>
          <span className="shrink-0 text-[11px] font-medium text-white/90">Tap to change</span>
        </span>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative flex aspect-[4/3] w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-b from-[#fbfaf6] to-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-zinc-400 hover:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.15)] active:scale-[0.97] sm:rounded-2xl"
      aria-label={`${label} — tap to add`}
    >
      <span className="min-h-0 flex-1 pt-1">{variant === "face" ? <FaceSketch /> : <SmileSketch />}</span>
      <span className="pb-2.5">
        <span className="block text-xs font-semibold text-zinc-800">{label}</span>
        <span className="mt-0.5 block text-[11px] font-medium text-zinc-500">Tap to add</span>
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </button>
  )
}
