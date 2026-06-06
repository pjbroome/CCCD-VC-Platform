import { StaffThemeProvider } from "@/components/vc/ThemeProvider"

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffThemeProvider>{children}</StaffThemeProvider>
}
