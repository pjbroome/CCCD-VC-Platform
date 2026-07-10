"use client"

import { useState } from "react"
import { THEMES } from "@/lib/theme"
import { useTheme } from "@/components/vc/ThemeProvider"

export function ThemeSwitcher() {
  const { themeId, setThemeId, theme } = useTheme()
  const [open, setOpen] = useState(false)

  const surprise = () => {
    const others = THEMES.filter((t) => t.id !== themeId)
    const pick = others[Math.floor(Math.random() * others.length)]
    if (pick) setThemeId(pick.id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--k-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--k-text)] shadow-sm transition hover:bg-zinc-50"
        title="Change the backend theme"
      >
        <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: theme.swatch }} />
        <span className="hidden sm:inline">Theme</span>
        <svg className="size-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-[var(--k-line)] bg-white p-2 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.25)]">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Backend theme</p>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setThemeId(t.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-zinc-50 ${
                  t.id === themeId ? "bg-zinc-50" : ""
                }`}
              >
                <span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: t.swatch }} />
                <span className="font-medium text-zinc-800">{t.name}</span>
                {t.id === themeId && (
                  <svg className="ml-auto size-4" style={{ color: t.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-zinc-100" />
            <button
              type="button"
              onClick={surprise}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              <span className="text-base leading-none">🎲</span>
              Surprise me
            </button>
          </div>
        </>
      )}
    </div>
  )
}
