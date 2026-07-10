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
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
}

export function VCFooter() {
  return (
    <footer className="border-t border-zinc-100 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="grid items-start gap-10 md:grid-cols-[1.5fr_1fr]"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {/* Left — Branding */}
          <motion.div variants={fadeUp}>
            <p className="text-sm font-bold tracking-tight text-zinc-900">
              Charlotte Center for Cosmetic Dentistry
            </p>
            <p className="mt-1.5 text-sm text-zinc-400">
              Dr. Patrick Broome &middot; Charlotte, NC
            </p>
            <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-zinc-400">
              Personalized cosmetic dentistry with 30+ years of experience.
              Your smile transformation starts with a simple virtual
              consultation.
            </p>
          </motion.div>

          {/* Right — Contact */}
          <motion.div variants={fadeUp} className="flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Contact
            </p>
            <a
              href="tel:+17043644711"
              className="text-sm text-zinc-600 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-[#c4a052]"
            >
              (704) 364-4711
            </a>
            <a
              href="https://www.charlottecentercosmeticdentistry.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-600 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-[#c4a052]"
            >
              charlottecentercosmeticdentistry.com
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-16 border-t border-zinc-100 pt-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
        >
          <p className="text-xs text-zinc-300">
            &copy; {new Date().getFullYear()} CCCD. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
