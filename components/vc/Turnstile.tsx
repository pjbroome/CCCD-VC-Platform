"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
export const TURNSTILE_ENABLED = !!SITE_KEY

/**
 * Cloudflare Turnstile bot challenge. Renders nothing unless
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so it's a no-op until you add the
 * free key. Calls onToken with the verification token (or "" on expire/error).
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let cancelled = false

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        // interaction-only: stay invisible for visitors who auto-pass (luxury look),
        // and only surface a challenge when Cloudflare needs one — so a flagged real
        // patient gets a quick 1-click check instead of being silently blocked.
        appearance: "interaction-only",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      })
    }

    const onLoad = () => render()
    if (window.turnstile) {
      render()
    } else {
      let s = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null
      if (!s) {
        s = document.createElement("script")
        s.id = "cf-turnstile-script"
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        s.async = true
        s.defer = true
        document.head.appendChild(s)
      }
      s.addEventListener("load", onLoad)
    }

    return () => {
      cancelled = true
      const s = document.getElementById("cf-turnstile-script")
      if (s) s.removeEventListener("load", onLoad)
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* ignore */ }
        widgetId.current = null
      }
    }
  }, [onToken])

  if (!SITE_KEY) return null
  return <div ref={ref} className="my-2 flex justify-center" />
}
