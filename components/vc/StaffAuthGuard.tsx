"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isAuthed, getAdminSession, clearAuthToken } from "@/lib/api"

/**
 * Gates all /staff pages behind a stored auth token. The /staff/login route is
 * exempt (so you can actually log in). In dev mode (no VC_ADMIN_PASSWORD on the
 * backend) any password works; once the password is set, only the real one does.
 */
export function StaffAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const isLogin = pathname === "/staff/login"

  useEffect(() => {
    if (isLogin) {
      setReady(true)
      return
    }
    const toLogin = () => router.replace(`/staff/login?returnTo=${encodeURIComponent(pathname || "/staff")}`)
    if (!isAuthed()) {
      toLogin()
      return
    }
    // Validate the stored token server-side; a stale/expired token (e.g. after a
    // backend restart or 24h expiry) redirects to login instead of erroring.
    let cancelled = false
    ;(async () => {
      const { valid } = await getAdminSession()
      if (cancelled) return
      if (!valid) {
        clearAuthToken()
        toLogin()
        return
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [isLogin, pathname, router])

  if (isLogin) return <>{children}</>
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--k-bg)] text-sm text-zinc-400">
        Checking access…
      </div>
    )
  }
  return <>{children}</>
}
