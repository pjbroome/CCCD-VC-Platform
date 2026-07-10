"use client"

import { motion } from "motion/react"

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
      staggerChildren: 0.2,
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

const steps = [
  {
    number: 1,
    title: "Submit",
    subtitle: "Two Required Photos",
    description:
      "Upload a Full Face Smiling Selfie and a Close-up Smile pic. Our AI Smile Agent screens each photo for quality so Dr. Broome can give you the best feedback.",
    icon: (
      <svg
        className="size-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
        />
      </svg>
    ),
  },
  {
    number: 2,
    title: "Request",
    subtitle: "Tell Us What Matters",
    description:
      "Describe what you'd like to improve about your smile and what kind of feedback you want from Dr. Broome. The more detail, the better your consultation.",
    icon: (
      <svg
        className="size-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
        />
      </svg>
    ),
  },
  {
    number: 3,
    title: "Send",
    subtitle: "Reply Within 24 Hours",
    description:
      "CCCD's AI Smile Agent analyzes your photos, scans Dr. Broome's library of completed cases, and pulls matches. You'll receive a personalized video reply with his suggestions.",
    icon: (
      <svg
        className="size-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
        />
      </svg>
    ),
  },
]

export function VCSteps() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block rounded-full bg-zinc-900/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              How It Works
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tighter leading-none md:text-5xl">
              3 Easy Steps
            </h2>
          </motion.div>

          <div className="mt-16 flex flex-col gap-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                variants={fadeUp}
                className={`grid items-center gap-8 md:grid-cols-[1fr_1fr] ${
                  index % 2 === 1 ? "md:direction-rtl" : ""
                }`}
              >
                {/* Content side */}
                <div
                  className={`${index % 2 === 1 ? "md:order-2 md:text-left" : ""}`}
                  style={{ direction: "ltr" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-[#c4a052] text-xs font-bold text-white">
                      {step.number}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-[#c4a052]">
                    {step.subtitle}
                  </p>
                  <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-zinc-500">
                    {step.description}
                  </p>
                </div>

                {/* Visual side (double-bezel card) */}
                <div
                  className={`${index % 2 === 1 ? "md:order-1" : ""}`}
                  style={{ direction: "ltr" }}
                >
                  <div className="rounded-[2rem] bg-zinc-950/[0.03] p-1.5 ring-1 ring-zinc-950/[0.04]">
                    <div className="flex items-center justify-center rounded-[calc(2rem-0.375rem)] bg-white px-8 py-10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)]">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-[#c4a052]/8 text-[#c4a052]">
                        {step.icon}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
