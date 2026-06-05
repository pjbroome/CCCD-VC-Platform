"use client"

import { useParams } from "next/navigation"
import { SAMPLE_THEMES } from "@/components/vc/sampleThemes"
import { SampleConsult } from "@/components/vc/SampleConsult"

export default function SampleVariantPage() {
  const params = useParams()
  const raw = parseInt(String(params.v), 10)
  const n = Math.min(Math.max(Number.isFinite(raw) ? raw : 1, 1), SAMPLE_THEMES.length)
  return <SampleConsult theme={SAMPLE_THEMES[n - 1]} />
}
