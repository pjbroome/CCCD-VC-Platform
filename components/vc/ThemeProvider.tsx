"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  DEFAULT_THEME_ID,
  THEME_MAP,
  THEME_STORAGE_KEY,
  accentVars,
  NEUTRAL_VARS,
  type Theme,
  type ThemeId,
} from "@/lib/theme"

type ThemeCtx = {
  themeId: ThemeId
  theme: Theme
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

export function StaffThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID)

  // Load saved choice on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null
      if (saved && THEME_MAP[saved]) setThemeIdState(saved)
    } catch {
      /* ignore */
    }
  }, [])

  // Apply CSS variables to the document root so every staff page inherits them.
  useEffect(() => {
    const theme = THEME_MAP[themeId] || THEME_MAP[DEFAULT_THEME_ID]
    const root = document.documentElement
    const vars = { ...NEUTRAL_VARS, ...accentVars(theme) }
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  }, [themeId])

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ themeId, theme: THEME_MAP[themeId] || THEME_MAP[DEFAULT_THEME_ID], setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within StaffThemeProvider")
  return ctx
}
