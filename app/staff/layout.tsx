import { StaffThemeProvider } from "@/components/vc/ThemeProvider"
import { StaffAuthGuard } from "@/components/vc/StaffAuthGuard"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffThemeProvider>
      <StaffAuthGuard>{children}</StaffAuthGuard>
    </StaffThemeProvider>
  )
}
