"use client"

import { motion } from "motion/react"
import { AuroraText } from "@/components/ui/aurora-text"

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
      staggerChildren: 0.15,
      delayChildren: 0.1,
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

export function VCHero() {
  return (
    <section className="relative px-4 pb-16 pt-20 sm:px-6 sm:pt-32 md:pb-24">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="grid items-center gap-12 md:grid-cols-[1.2fr_0.8fr] md:gap-16"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {/* Left content */}
          <div className="max-w-2xl">
            <motion.div variants={fadeUp}>
              <span className="inline-block rounded-full bg-[#c4a052]/8 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#c4a052]">
                Charlotte Center for Cosmetic Dentistry
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-6 text-4xl font-bold tracking-tighter leading-none md:text-6xl"
            >
              Your{" "}
              <AuroraText
                colors={["#c4a052", "#d4b062", "#e8c972", "#c4a052"]}
                speed={1.5}
              >
                Virtual Consultation
              </AuroraText>
              <br />
              <span className="text-zinc-400">Starts Here</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-500"
            >
              Submit two photos, tell Dr. Broome what matters most to you, and
              receive a personalized video reply with his expert recommendations
              — all within 24 hours.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              {["100% Free", "Takes 2\u20133 Minutes", "No Commitment"].map(
                (item) => (
                  <span
                    key={item}
                    className="flex items-center gap-2 text-sm text-zinc-500"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10">
                      <svg
                        className="size-3 text-emerald-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    {item}
                  </span>
                )
              )}
            </motion.div>
          </div>

          {/* Right — Dr. Broome card (double-bezel) */}
          <motion.div variants={fadeUp} className="relative hidden md:block">
            <div className="rounded-[2rem] bg-zinc-950/[0.03] p-2 ring-1 ring-zinc-950/[0.04]">
              <div className="relative overflow-hidden rounded-[calc(2rem-0.5rem)] bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)]">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-[#c4a052]/8">
                    <svg
                      className="size-8 text-[#c4a052]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Dr. Patrick Broome
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      30+ Years of Cosmetic Excellence
                    </p>
                  </div>
                  <div className="w-full border-t border-zinc-100" />
                  <div className="grid w-full grid-cols-2 gap-4">
                    <div className="rounded-xl bg-zinc-50 px-3 py-3">
                      <p className="text-2xl font-bold tracking-tight text-zinc-900">
                        15k+
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        Smile Transformations
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-3">
                      <p className="text-2xl font-bold tracking-tight text-zinc-900">
                        4.9
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        Patient Rating
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
