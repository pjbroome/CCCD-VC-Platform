"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminLogin } from "@/lib/api"

export default function StaffLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await adminLogin(password)
      let dest = "/staff"
      if (typeof window !== "undefined") {
        const rt = new URLSearchParams(window.location.search).get("returnTo")
        if (rt && rt.startsWith("/staff")) dest = rt
      }
      router.replace(dest)
    } catch {
      setErr("Incorrect password. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--k-bg)] px-4 text-[var(--k-text)]">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_24px_70px_-20px_rgba(20,18,40,0.25)] ring-1 ring-[var(--k-line)]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}>
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-900">VC Portal · Staff</p>
            <p className="text-[11px] text-zinc-400">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Staff password</span>
            <input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[var(--k-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--k-accent-soft)]"
              placeholder="••••••••"
            />
          </label>

          {err && <p className="text-xs font-medium text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={busy || !password}
            className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
            style={{ backgroundImage: "linear-gradient(135deg,var(--k-grad-from),var(--k-grad-to))" }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] text-zinc-300">Charlotte Center for Cosmetic Dentistry · Staff Portal</p>
      </div>
    </main>
  )
}
