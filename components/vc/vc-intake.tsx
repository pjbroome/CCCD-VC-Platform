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
  referral?: string
}

type SubmitState = "idle" | "uploading" | "submitting" | "success" | "error"

const REFERRAL_SOURCES = [
  "Friend or family referral",
  "Existing patient",
  "Google search",
  "Instagram",
  "Facebook",
  "TikTok",
  "Saw a patient's results",
  "Other",
]

export function VCIntake() {
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    zip: "",
    concern: "",
  })
  const [fullFace, setFullFace] = useState<File | null>(null)
  const [closeUp, setCloseUp] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [requestId, setRequestId] = useState<number | null>(null)
  const [honeypot, setHoneypot] = useState("") // bot trap — must stay empty for real users
  const [referralSource, setReferralSource] = useState("")
  const [referralOther, setReferralOther] = useState("")
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

  const validate = (): FormErrors => {
    const e: FormErrors = {}
    if (!form.firstName.trim()) e.firstName = "First name is required"
    if (!form.lastName.trim()) e.lastName = "Last name is required"
    if (!form.email.trim()) {
      e.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Please enter a valid email"
    }
    if (!form.phone.trim()) {
      e.phone = "Phone number is required"
    } else if (!/^[\d\s()+-]{7,20}$/.test(form.phone)) {
      e.phone = "Please enter a valid phone number"
    }
    if (!form.zip.trim()) {
      e.zip = "Zip code is required"
    } else if (!/^\d{5}$/.test(form.zip.trim())) {
      e.zip = "Enter a 5-digit zip code"
    }
    if (!form.concern.trim()) e.concern = "Please describe your dental concern"
    if (!fullFace) e.photos = "A full-face selfie is required"
    else if (!closeUp) e.photos = "A close-up smile photo is required"
    if (referralSource === "Other" && !referralOther.trim()) e.referral = "Please tell us how you heard about us"
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

      const payload: VCRequestPayload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        date_of_birth: null,
        // No dedicated ZIP column on the backend yet — store it in the location field.
        city: form.zip.trim() || null,
        state: null,
        concern: form.concern.trim(),
        // Consent statement removed from the form (per staff feedback); contract still expects a boolean.
        consent_acknowledged: true,
        photos: photoUrls,
        referral_source: referralSource === "Other" ? referralOther.trim() : referralSource || undefined,
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-8">
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
              " has been received. Dr.\u00a0Broome will review your photos and send a personalized video reply within 24\u00a0hours."}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {"We\u2019ll send your reply to "}
            <span className="font-medium text-zinc-600">{form.email}</span>
          </p>
          <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#c4a052]/10">
                <svg className="size-4 text-[#c4a052]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900">What happens next?</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {"Our AI Smile Agent will analyze your photos and scan Dr.\u00a0Broome\u2019s library of completed cases. You\u2019ll receive a personalized video reply with his treatment suggestions."}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmitState("idle")
              setForm({ firstName: "", lastName: "", email: "", phone: "", zip: "", concern: "" })
              setFullFace(null)
              setCloseUp(null)
              setExtras([])
              handleTurnstileToken("")
              setReferralSource("")
              setReferralOther("")
              setRequestId(null)
            }}
            className="mt-6 text-sm font-medium text-[#c4a052] underline underline-offset-4 transition-colors hover:text-[#b8933f]"
          >
            Submit another consultation
          </button>
          <a
            href="/feedback"
            className="mt-3 block text-xs font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-[#c4a052]"
          >
            Testing for us? Take the 60‑second feedback survey →
          </a>
        </motion.div>
        <p className="mt-8 text-center text-[10px] text-zinc-300">
          {"Charlotte Center for Cosmetic Dentistry \u00b7 Dr.\u00a0Patrick Broome \u00b7 Charlotte,\u00a0NC"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 px-4 py-5 sm:px-6 sm:py-6">
      <motion.div
        className="mx-auto flex w-full max-w-lg flex-1 flex-col"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={fadeIn} className="mb-4 text-center sm:mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">
            Charlotte Center for Cosmetic Dentistry
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tighter text-zinc-900 sm:text-2xl">
            Virtual Consultation
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
            {"Fill out the form below, upload your photos, and get a personal video reply within 24\u00a0hours."}
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div variants={fadeIn} className="flex flex-1 flex-col">
          <div
            ref={formRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] ring-1 ring-zinc-950/[0.04] sm:rounded-3xl sm:p-6"
          >
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
                  className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
                >
                  {errors.submit}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 1 - Patient Info */}
            <div>
              <p className="mb-3 text-xs font-semibold text-zinc-900 sm:text-sm">
                <StepBadge n={1} /> Your Information
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
              <div className="mt-2.5 sm:mt-3">
                <label className="mb-1 block text-[10px] font-medium text-zinc-500 sm:text-xs">How did you hear about us?</label>
                <select
                  value={referralSource}
                  onChange={(e) => { setReferralSource(e.target.value); if (errors.referral) setErrors((p) => { const n = { ...p }; delete n.referral; return n }) }}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 transition-all focus:border-[#c4a052]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c4a052]/10 sm:px-3 sm:py-2.5 sm:text-sm"
                >
                  <option value="">--</option>
                  {REFERRAL_SOURCES.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
                {referralSource === "Other" && (
                  <input
                    type="text"
                    value={referralOther}
                    onChange={(e) => { setReferralOther(e.target.value); if (errors.referral) setErrors((p) => { const n = { ...p }; delete n.referral; return n }) }}
                    placeholder="Please tell us how"
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 transition-all focus:border-[#c4a052]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c4a052]/10 sm:px-3 sm:py-2.5 sm:text-sm"
                  />
                )}
                {errors.referral && <p className="mt-1 text-[10px] text-red-500">{errors.referral}</p>}
              </div>
            </div>

            {/* Step 2 - Photos */}
            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-900 sm:text-sm">
                <StepBadge n={2} /> Upload Your Photos
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
                <p className="mb-1.5 text-[10px] font-medium text-zinc-500 sm:text-xs">Optional — add up to 4 more (different angles, retracted, side profile)</p>
                <div className="flex flex-wrap items-center gap-2">
                  {extras.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${f.lastModified}`} className="relative size-16 overflow-hidden rounded-lg border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={extraPreviews[i]} alt="" className="size-full object-cover" />
                      <button type="button" onClick={() => setExtras((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white">×</button>
                    </div>
                  ))}
                  {extras.length < 4 && (
                    <label className="flex size-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition hover:border-[#c4a052]/50 hover:text-[#c4a052]">
                      <span className="text-xl leading-none">+</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                        const all = Array.from(e.target.files || [])
                        const ok = all.filter((f) => f.size <= 14 * 1024 * 1024)
                        if (ok.length < all.length) setErrors((prev) => ({ ...prev, photos: "Some images were too large (max 14MB each) and were skipped." }))
                        setExtras((p) => [...p, ...ok].slice(0, 4))
                        e.currentTarget.value = ""
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 - Concern */}
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-2 text-xs font-semibold text-zinc-900 sm:text-sm">
                <StepBadge n={3} /> What Matters Most to You?
              </p>
              {errors.concern && <p className="mb-1 text-[10px] text-red-500">{errors.concern}</p>}
              <textarea
                value={form.concern}
                onChange={(e) => updateField("concern", e.target.value)}
                placeholder="I'd love to know which options would suit my face shape..."
                className={`min-h-0 w-full flex-1 resize-none rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 transition-all duration-300 focus:border-[#c4a052]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c4a052]/10 sm:px-4 sm:py-3 sm:text-sm ${errors.concern ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200"}`}
                rows={3}
              />
            </div>

            {/* Step 4 - Submit */}
            <div>
              {/* Bot challenge — renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set */}
              <Turnstile ref={turnstileRef} onToken={handleTurnstileToken} />

              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c4a052] to-[#d4b062] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_-2px_rgba(196,160,82,0.4)] transition-all duration-200 hover:shadow-[0_6px_20px_-2px_rgba(196,160,82,0.5)] disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5 sm:text-base"
                whileTap={isSubmitting ? {} : { scale: 0.97 }}
                transition={spring}
              >
                {isSubmitting ? (
                  <>
                    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {submitState === "uploading" ? "Uploading photos..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold sm:size-5 sm:text-[10px]">
                      4
                    </span>
                    Send My Consultation
                    <svg
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                      />
                    </svg>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={fadeIn}
          className="mt-3 text-center text-[10px] text-zinc-300 sm:mt-4"
        >
          {"100% Free \u00b7 Takes 2-3 Minutes \u00b7 Dr.\u00a0Patrick Broome \u00b7 Charlotte,\u00a0NC"}
        </motion.p>
      </motion.div>
    </div>
  )
}

/* Reusable sub-components */

function StepBadge({ n }: { n: number }) {
  return (
    <span className="mr-1.5 inline-flex size-4 items-center justify-center rounded-full bg-[#c4a052] text-[9px] font-bold text-white sm:size-5 sm:text-[10px]">
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
        className={`w-full rounded-lg border bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 transition-all focus:border-[#c4a052]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c4a052]/10 sm:px-3 sm:py-2.5 sm:text-sm ${error ? "border-red-300 ring-1 ring-red-200" : "border-zinc-200"}`}
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
      className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-2 py-4 text-center transition-all duration-200 hover:border-[#c4a052]/30 hover:bg-[#c4a052]/[0.03] active:scale-[0.97] sm:rounded-2xl sm:px-3 sm:py-5"
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
          <div className="mb-1.5 flex size-8 items-center justify-center rounded-lg bg-[#c4a052]/8 transition-colors duration-200 group-hover:bg-[#c4a052]/12 sm:size-9">
            <svg
              className="size-4 text-[#c4a052]"
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
          <span className="mt-1 flex items-center gap-1 text-[9px] font-medium text-[#c4a052] sm:text-[10px]">
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
