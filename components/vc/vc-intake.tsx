"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
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
  "Whiter smile",
  "Straighter teeth",
  "Fix a chip or gap",
  "Replace old crowns or veneers",
  "Full smile makeover",
  "Not sure — show me my options",
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s()+-]{7,20}$/
const ZIP_RE = /^\d{5}$/

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
  // "Whiter smile" pre-selected: the most common wish, and a smart default the
  // patient can tap off — the form starts with one answer already given.
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>(["Whiter smile"])
  const [showExtras, setShowExtras] = useState(false)
  const [fullFace, setFullFace] = useState<File | null>(null)
  const [closeUp, setCloseUp] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [requestId, setRequestId] = useState<number | null>(null)
  const [honeypot, setHoneypot] = useState("") // bot trap — must stay empty for real users
  const [sourceUrl, setSourceUrl] = useState("")
  const [extras, setExtras] = useState<File[]>([])

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

  const TOKEN_MAX_AGE_MS = 120_000
  const TOKEN_WAIT_MS = 20_000

  const freshTurnstileToken = async (forceReset = false): Promise<string> => {
    if (!TURNSTILE_ENABLED) return ""
    const isFresh = tokenRef.current && Date.now() - tokenIssuedAt.current < TOKEN_MAX_AGE_MS
    if (isFresh && !forceReset) return tokenRef.current
    tokenRef.current = ""
    turnstileRef.current?.reset()
    // Wait for the widget callback — instant when Cloudflare auto-passes, longer
    // if it decides to show the visitor a 1-click interactive check.
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

  // Object URLs for photo thumbnails — created per file, revoked on change/unmount
  const fullFacePreview = useMemo(() => (fullFace ? URL.createObjectURL(fullFace) : null), [fullFace])
  useEffect(() => () => { if (fullFacePreview) URL.revokeObjectURL(fullFacePreview) }, [fullFacePreview])
  const closeUpPreview = useMemo(() => (closeUp ? URL.createObjectURL(closeUp) : null), [closeUp])
  useEffect(() => () => { if (closeUpPreview) URL.revokeObjectURL(closeUpPreview) }, [closeUpPreview])
  const extraPreviews = useMemo(() => extras.map((f) => URL.createObjectURL(f)), [extras])
  useEffect(() => () => { extraPreviews.forEach((u) => URL.revokeObjectURL(u)) }, [extraPreviews])

  const formRef = useRef<HTMLDivElement>(null)

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
    setSelectedConcerns((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
    setErrors((prev) => {
      if (!prev.concern) return prev
      const next = { ...prev }
      delete next.concern
      return next
    })
  }, [])

  const concernSatisfied = selectedConcerns.length > 0 || form.concern.trim().length > 0

  // Goal-gradient progress: arriving counts as the first step, so the meter
  // never reads zero. Seven milestones fill the remaining 80%.
  const milestones = [
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0,
    EMAIL_RE.test(form.email),
    PHONE_RE.test(form.phone),
    ZIP_RE.test(form.zip.trim()),
    concernSatisfied,
    !!fullFace,
    !!closeUp,
  ]
  const completed = milestones.filter(Boolean).length
  const progressPct = Math.round(20 + (completed / milestones.length) * 80)
  const remaining = milestones.length - completed
  const progressLabel =
    remaining === 0 ? "Ready to send" : completed === 0 ? "Started" : remaining === 1 ? "1 step left" : `${remaining} steps left`

  const infoDone = milestones[0] && milestones[1] && milestones[2] && milestones[3]
  const photosDone = !!fullFace && !!closeUp

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
    } else if (!PHONE_RE.test(form.phone)) {
      e.phone = "Please enter a valid phone number"
    }
    if (!form.zip.trim()) {
      e.zip = "Zip code is required"
    } else if (!ZIP_RE.test(form.zip.trim())) {
      e.zip = "Enter a 5-digit zip code"
    }
    if (!concernSatisfied) e.concern = "Tap what you'd like to change — or tell us in your own words"
    if (!fullFace) e.photos = "A full-face selfie is required"
    else if (!closeUp) e.photos = "A close-up smile photo is required"
    return e
  }

  const handleSubmit = async () => {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      formRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    setErrors({})

    try {
      setSubmitState("uploading")
      const photoUrls: string[] = []

      if (fullFace) {
        const result: PhotoUploadResponse = await uploadPhoto(fullFace)
        photoUrls.push(result.url)
      }
      if (closeUp) {
        const result: PhotoUploadResponse = await uploadPhoto(closeUp)
        photoUrls.push(result.url)
      }
      for (const extra of extras.slice(0, 4)) {
        const result: PhotoUploadResponse = await uploadPhoto(extra)
        photoUrls.push(result.url)
      }

      setSubmitState("submitting")

      // Mint the bot-check token *after* the (possibly slow) photo uploads so it
      // can't expire between page load and submission.
      const token = await freshTurnstileToken()
      if (TURNSTILE_ENABLED && !token) {
        setErrors({ submit: "Our security check didn't load. Please refresh the page and try again — your photos are fine to re-select." })
        setSubmitState("error")
        return
      }

      // Chips + free text combine into the single concern field the backend expects.
      const concernText = [selectedConcerns.join(" · "), form.concern.trim()]
        .filter(Boolean)
        .join(" — ")

      const payload: VCRequestPayload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        date_of_birth: null,
        // No dedicated ZIP column on the backend yet — store it in the location field.
        city: form.zip.trim() || null,
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

      setRequestId(response.id)
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f5f0] px-4 py-8 [background-image:radial-gradient(ellipse_50%_35%_at_20%_0%,rgba(4,120,87,0.07),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(196,160,82,0.08),transparent)]">
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
            {"Thank you, " + form.firstName + "! Your consultation request" +
              (requestId ? ` (#${requestId})` : "") +
              " has been received. Dr. Broome will review your photos and send a personalized video reply within 24 hours."}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {"We’ll send your reply to "}
            <span className="font-medium text-zinc-600">{form.email}</span>
          </p>
          <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10">
                <svg className="size-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900">What happens next?</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {"Our AI Smile Agent will analyze your photos and scan Dr. Broome’s library of completed cases. You’ll receive a personalized video reply with his treatment suggestions."}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmitState("idle")
              setForm({ firstName: "", lastName: "", email: "", phone: "", zip: "", concern: "" })
              setSelectedConcerns(["Whiter smile"])
              setShowExtras(false)
              setFullFace(null)
              setCloseUp(null)
              setExtras([])
              handleTurnstileToken("")
              setRequestId(null)
            }}
            className="mt-6 text-sm font-medium text-emerald-700 underline underline-offset-4 transition-colors hover:text-emerald-800"
          >
            Submit another consultation
          </button>
          <a
            href="/feedback"
            className="mt-3 block text-xs font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-emerald-700"
          >
            Testing for us? Take the 60‑second feedback survey →
          </a>
        </motion.div>
        <p className="mt-8 text-center text-[10px] text-zinc-300">
          {"Dr. Patrick Broome · Charlotte, NC"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f5f0] px-4 py-6 [background-image:radial-gradient(ellipse_50%_35%_at_20%_0%,rgba(4,120,87,0.07),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(196,160,82,0.08),transparent)] sm:px-6 sm:py-8">
      <motion.div
        className="mx-auto flex w-full max-w-lg flex-1 flex-col"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header — minimal: title, gold hairline, one line */}
        <motion.div variants={fadeIn} className="mb-5 text-center">
          <h1 className="text-2xl font-bold tracking-tighter text-zinc-900 sm:text-3xl">
            Virtual Consultation
          </h1>
          <div className="mx-auto mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-[#c4a052] to-[#d4b062]" />
          <p className="mx-auto mt-2.5 max-w-sm text-xs leading-relaxed text-zinc-500 sm:text-sm">
            {"3 easy steps"}
          </p>
        </motion.div>

        {/* Progress — arriving counts as the first step, so it never reads 0% */}
        <motion.div variants={fadeIn} className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 sm:text-[11px]">
              Your consultation
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 sm:text-xs">
              {progressPct}% · {progressLabel}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Consultation request progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70"
          >
            <div
              className="h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${progressPct / 100})`, backgroundImage: `linear-gradient(to right, ${EMERALD}, ${EMERALD_LIGHT})` }}
            />
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

        <div ref={formRef} className="flex flex-1 flex-col gap-3.5">
          {/* Card 1 — details */}
          <motion.section variants={fadeIn} className="rounded-2xl bg-white p-4 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-5">
            <p className="mb-3 flex items-center text-sm font-semibold text-zinc-900">
              <StepBadge n={1} done={infoDone} /> Your details
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <InputField label="First Name" value={form.firstName} onChange={(v) => updateField("firstName", v)} error={errors.firstName} required autoComplete="given-name" />
              <InputField label="Last Name" value={form.lastName} onChange={(v) => updateField("lastName", v)} error={errors.lastName} required autoComplete="family-name" />
            </div>
            <div className="mt-2.5 sm:mt-3">
              <InputField label="Email" type="email" value={form.email} onChange={(v) => updateField("email", v)} error={errors.email} required autoComplete="email" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-3 sm:gap-3">
              <InputField label="Mobile Phone" type="tel" value={form.phone} onChange={(v) => updateField("phone", v)} error={errors.phone} required autoComplete="tel" />
              <InputField label="Zip Code" type="text" inputMode="numeric" maxLength={5} value={form.zip} onChange={(v) => updateField("zip", v.replace(/\D/g, "").slice(0, 5))} error={errors.zip} required autoComplete="postal-code" />
            </div>
          </motion.section>

          {/* Card 2 — goals */}
          <motion.section variants={fadeIn} className="rounded-2xl bg-white p-4 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-5">
            <p className="mb-2.5 flex items-center text-sm font-semibold text-zinc-900">
              <StepBadge n={2} done={concernSatisfied} /> What would you love to change?
            </p>
            {errors.concern && <p className="mb-1.5 text-[10px] text-red-500">{errors.concern}</p>}
            <div className="mb-2.5 flex flex-wrap gap-1.5 sm:gap-2">
              {CONCERN_CHIPS.map((chip) => {
                const selected = selectedConcerns.includes(chip)
                return (
                  <motion.button
                    key={chip}
                    type="button"
                    onClick={() => toggleConcern(chip)}
                    aria-pressed={selected}
                    whileTap={{ scale: 0.95 }}
                    className={`min-h-11 rounded-full border px-3.5 py-2 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 sm:text-xs ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {selected && <span className="mr-1 text-emerald-400">✓</span>}
                    {chip}
                  </motion.button>
                )
              })}
            </div>
            <textarea
              value={form.concern}
              onChange={(e) => updateField("concern", e.target.value)}
              placeholder="Anything else you'd like Dr. Broome to know? (optional)"
              className={`w-full resize-none rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 transition-all duration-300 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300/30 sm:px-4 sm:py-3 sm:text-sm ${errors.concern ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200"}`}
              rows={2}
            />
          </motion.section>

          {/* Card 3 — photos */}
          <motion.section variants={fadeIn} className="rounded-2xl bg-white p-4 shadow-[0_2px_16px_-8px_rgba(0,0,0,0.10)] ring-1 ring-zinc-950/[0.04] sm:p-5">
            <p className="mb-2.5 flex items-center text-sm font-semibold text-zinc-900">
              <StepBadge n={3} done={photosDone} /> Add your photos
            </p>
            {errors.photos && <p className="mb-2 text-[10px] text-red-500">{errors.photos}</p>}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <UploadCard
                label="Full Face Selfie"
                file={fullFace}
                preview={fullFacePreview}
                onFile={(f) => { if (f && f.size > 14 * 1024 * 1024) { setErrors((prev) => ({ ...prev, photos: "That image is too large (max 14MB). Please choose a smaller photo." })); return } setFullFace(f); if (errors.photos) setErrors((prev) => { const next = { ...prev }; delete next.photos; return next }) }}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                  />
                }
                icon2={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                  />
                }
              />
              <UploadCard
                label="Close-up Smile"
                file={closeUp}
                preview={closeUpPreview}
                onFile={(f) => { if (f && f.size > 14 * 1024 * 1024) { setErrors((prev) => ({ ...prev, photos: "That image is too large (max 14MB). Please choose a smaller photo." })); return } setCloseUp(f); if (errors.photos) setErrors((prev) => { const next = { ...prev }; delete next.photos; return next }) }}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                  />
                }
              />
            </div>
            <div className="mt-3">
              {!showExtras ? (
                <button
                  type="button"
                  onClick={() => setShowExtras(true)}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium text-zinc-700 transition-colors duration-200 hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 sm:text-xs"
                >
                  <span className="text-base leading-none">+</span>
                  Add
                  <span className="font-normal text-zinc-400">· optional</span>
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                  <p className="mb-1.5 text-[10px] font-medium text-zinc-500 sm:text-xs">Up to 4 more — different angles, retracted, side profile</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((i) =>
                      extras[i] ? (
                        <div key={`${extras[i].name}-${extras[i].size}-${extras[i].lastModified}`} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={extraPreviews[i]} alt="" className="size-full object-cover" />
                          <button type="button" onClick={() => setExtras((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white">×</button>
                        </div>
                      ) : (
                        <label key={`empty-${i}`} className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-600">
                          <span className="text-xl leading-none">+</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                            const all = Array.from(e.target.files || [])
                            const ok = all.filter((f) => f.size <= 14 * 1024 * 1024)
                            if (ok.length < all.length) setErrors((prev) => ({ ...prev, photos: "Some images were too large (max 14MB each) and were skipped." }))
                            setExtras((p) => [...p, ...ok].slice(0, 4))
                            e.currentTarget.value = ""
                          }} />
                        </label>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.section>

          {/* Submit */}
          <motion.div variants={fadeIn}>
            {/* Bot challenge — renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set */}
            <Turnstile ref={turnstileRef} onToken={handleTurnstileToken} />

            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold text-white shadow-[0_6px_24px_-6px_rgba(4,120,87,0.5)] transition-all duration-200 hover:shadow-[0_8px_28px_-6px_rgba(4,120,87,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-4 text-center text-[10px] text-zinc-400/70"
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
        className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-gradient-to-r from-emerald-700 to-emerald-500 text-white sm:size-6"
      >
        <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.span>
    )
  }
  return (
    <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white sm:size-6 sm:text-[11px]">
      {n}
    </span>
  )
}

function InputField({
  label, value, onChange, error, type = "text", required, autoComplete, inputMode, maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  required?: boolean
  autoComplete?: string
  inputMode?: "text" | "numeric" | "tel" | "email" | "url" | "search" | "none" | "decimal"
  maxLength?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-zinc-500 sm:text-xs">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`w-full rounded-lg border bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 transition-all focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300/30 sm:px-3 sm:py-2.5 sm:text-sm ${error ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200"}`}
      />
      {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

function UploadCard({
  label, file, preview, onFile, icon, icon2,
}: {
  label: string
  file: File | null
  preview?: string | null
  onFile: (f: File | null) => void
  icon: React.ReactNode
  icon2?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (file && preview) {
    return (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border border-emerald-500/30 bg-zinc-100 text-center transition-all duration-200 active:scale-[0.97] sm:rounded-2xl"
        aria-label={`${label} — tap to change`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`${label} preview`} className="size-full object-cover" />
        {/* Corner check badge */}
        <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
          <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        {/* Bottom label overlay */}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left">
          <span className="truncate text-[10px] font-semibold text-white sm:text-xs">{label}</span>
          <span className="shrink-0 text-[9px] font-medium text-white/80 sm:text-[10px]">Tap to change</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-2 py-4 text-center transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-100/60 active:scale-[0.97] sm:rounded-2xl sm:px-3 sm:py-5"
    >
      {file ? (
        <>
          <div className="mb-1.5 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 sm:size-9">
            <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="max-w-full truncate text-[10px] font-medium text-emerald-700 sm:text-xs">
            {file.name}
          </span>
          <span className="mt-0.5 text-[9px] text-zinc-400 sm:text-[10px]">
            Tap to change
          </span>
        </>
      ) : (
        <>
          <div className="mb-1.5 flex size-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors duration-200 group-hover:bg-zinc-200/70 sm:size-9">
            <svg
              className="size-4 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {icon}
              {icon2}
            </svg>
          </div>
          <span className="text-[10px] font-medium text-zinc-700 sm:text-xs">
            {label}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[9px] font-medium text-zinc-600 sm:text-[10px]">
            <svg
              className="size-2.5 sm:size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            Upload
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </button>
  )
}
