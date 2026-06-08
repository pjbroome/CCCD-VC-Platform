"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isAuthed } from "@/lib/api"

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
    if (!isAuthed()) {
      const returnTo = encodeURIComponent(pathname || "/staff")
      router.replace(`/staff/login?returnTo=${returnTo}`)
      return
    }
    setReady(true)
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
