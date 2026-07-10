"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { BorderBeam } from "@/components/ui/border-beam"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const springTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      ...springTransition,
      filter: { duration: 0.4 },
    },
  },
}

export function VCForm() {
  const [fullFaceFile, setFullFaceFile] = useState<File | null>(null)
  const [closeUpFile, setCloseUpFile] = useState<File | null>(null)
  const [message, setMessage] = useState("")

  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block rounded-full bg-zinc-900/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Start Your Consultation
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tighter leading-none md:text-5xl">
              Ready? Let&apos;s Go
            </h2>
          </motion.div>

          {/* Main form card — double-bezel architecture */}
          <motion.div variants={fadeUp} className="mt-12">
            <div className="rounded-[2rem] bg-zinc-950/[0.03] p-2 ring-1 ring-zinc-950/[0.04]">
              <div className="relative overflow-hidden rounded-[calc(2rem-0.5rem)] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)] sm:p-10">
                <BorderBeam
                  colorFrom="#c4a052"
                  colorTo="#e8c972"
                  size={80}
                  duration={8}
                  borderWidth={1.5}
                />

                {/* Photo uploads */}
                <div className="mb-10">
                  <label className="mb-1.5 block text-sm font-semibold text-zinc-900">
                    Step 1 — Submit Your Photos
                  </label>
                  <p className="mb-5 text-sm leading-relaxed text-zinc-500">
                    Two photos are required for your consultation.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <PhotoUploadCard
                      label="Full Face Smiling Selfie"
                      hint="Show your full face with a natural smile"
                      file={fullFaceFile}
                      onFileChange={setFullFaceFile}
                      id="full-face"
                      iconPath="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                      iconPath2="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                    />
                    <PhotoUploadCard
                      label="Close-up Smile"
                      hint="Get close and show your teeth clearly"
                      file={closeUpFile}
                      onFileChange={setCloseUpFile}
                      id="close-up"
                      iconPath="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="mb-10">
                  <label
                    htmlFor="vc-message"
                    className="mb-1.5 block text-sm font-semibold text-zinc-900"
                  >
                    Step 2 — Your Request
                  </label>
                  <p className="mb-3 text-sm leading-relaxed text-zinc-500">
                    Tell Dr. Broome what matters most to you and what feedback
                    you&apos;d like.
                  </p>
                  <textarea
                    id="vc-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I've been considering veneers for a while now. I'd love to know which options would suit my face shape and what kind of results I can expect..."
                    className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus:border-[#c4a052]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c4a052]/10"
                    rows={4}
                  />
                </div>

                {/* Submit */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-zinc-900">
                    Step 3 — Send It Off
                  </label>
                  <p className="mb-5 text-sm leading-relaxed text-zinc-500">
                    Your custom reply from Dr. Broome should arrive in less than
                    24 hours.
                  </p>

                  <ShimmerButton
                    className="w-full rounded-full py-4 text-base font-semibold active:scale-[0.98]"
                    background="linear-gradient(135deg, #c4a052, #d4b062)"
                    shimmerColor="rgba(255, 255, 255, 0.3)"
                    shimmerSize="0.08em"
                    borderRadius="9999px"
                  >
                    <span className="flex items-center gap-2.5">
                      Send My Consultation Request
                      <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
                        <svg
                          className="size-3.5"
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
                      </span>
                    </span>
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </motion.div>

          {/* AI Info */}
          <motion.div variants={fadeUp} className="mt-10">
            <div className="rounded-[2rem] bg-zinc-950/[0.03] p-1.5 ring-1 ring-zinc-950/[0.04]">
              <div className="flex items-start gap-4 rounded-[calc(2rem-0.375rem)] bg-white px-6 py-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] sm:px-8">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#c4a052]/8">
                  <svg
                    className="size-4.5 text-[#c4a052]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    What happens next?
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    CCCD&apos;s AI Smile Agent will analyze your photos, scan
                    Dr. Broome&apos;s smile library of completed cases, and pull
                    a few cases that match your request. A personalized video
                    reply from Dr. Broome will be sent to you explaining his
                    suggestions just for you.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function PhotoUploadCard({
  label,
  hint,
  file,
  onFileChange,
  id,
  iconPath,
  iconPath2,
}: {
  label: string
  hint: string
  file: File | null
  onFileChange: (file: File | null) => void
  id: string
  iconPath: string
  iconPath2?: string
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    onFileChange(selected)
  }

  return (
    <label
      htmlFor={id}
      className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[#c4a052]/30 hover:bg-[#c4a052]/[0.03] active:scale-[0.98]"
    >
      {file ? (
        <>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-emerald-500/10">
            <svg
              className="size-5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-emerald-700">
            {file.name}
          </span>
          <span className="mt-1 text-xs text-zinc-400">Tap to change</span>
        </>
      ) : (
        <>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#c4a052]/8 transition-colors duration-300 group-hover:bg-[#c4a052]/12">
            <svg
              className="size-5 text-[#c4a052]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={iconPath}
              />
              {iconPath2 && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={iconPath2}
                />
              )}
            </svg>
          </div>
          <span className="text-sm font-medium text-zinc-900">{label}</span>
          <span className="mt-1 text-xs text-zinc-400">{hint}</span>
          <span className="mt-3 flex items-center gap-1.5 rounded-full bg-[#c4a052]/8 px-3 py-1 text-[11px] font-medium text-[#c4a052] transition-colors duration-300 group-hover:bg-[#c4a052]/15">
            <svg
              className="size-3"
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
            Upload Photo
          </span>
        </>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </label>
  )
}
