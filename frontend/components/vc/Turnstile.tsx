"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
export const TURNSTILE_ENABLED = !!SITE_KEY

export interface TurnstileHandle {
  /** Re-run the challenge to mint a fresh token (tokens expire after ~5 min). */
  reset: () => void
  /** Diagnostic snapshot for precise, honest error messages. */
  getStatus: () => { scriptLoaded: boolean; rendered: boolean; lastError?: string }
}

/**
 * Cloudflare Turnstile bot challenge. Renders nothing unless
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so it's a no-op until you add the
 * free key. Calls onToken with the verification token (or "" on expire/error).
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string) => void }>(function Turnstile({ onToken }, handle) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const lastError = useRef<string | undefined>(undefined)
  const retried = useRef(false)

  useImperativeHandle(handle, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.reset(widgetId.current) } catch { /* ignore */ }
      }
    },
    getStatus: () => ({
      scriptLoaded: typeof window !== "undefined" && !!window.turnstile,
      rendered: !!widgetId.current,
      lastError: lastError.current,
    }),
  }), [])

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
        "error-callback": (code?: string) => {
          lastError.current = String(code ?? "unknown")
          onToken("")
          // One automatic re-render — transient network hiccups recover on retry.
          if (!retried.current && ref.current && window.turnstile) {
            retried.current = true
            setTimeout(() => {
              try {
                if (widgetId.current) window.turnstile!.remove(widgetId.current)
                widgetId.current = null
                render()
              } catch { /* ignore */ }
            }, 1500)
          }
        },
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
})
