# V0 Kleon Samples — VC Intake Page (Frontend)

## Overview
Virtual Consultation intake page for Charlotte Center for Cosmetic Dentistry.
Single-screen, mobile-first, no-scroll design with premium glassmorphism aesthetic.
This is the patient-facing frontend for the Virtual Consult system.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: MagicUI Pro, Radix UI
- **Font**: Geist (via next/font)
- **Deploy**: Vercel

## Development
```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
```

## Architecture
```
app/
├── page.tsx         # Main intake page
├── layout.tsx       # Root layout
├── globals.css      # Global styles
components/
├── ui/              # Reusable UI components
├── magicui/         # MagicUI Pro components
public/              # Static assets
```

## Design System
- **Aesthetic**: Kleon-inspired glassmorphism with premium feel
- **Layout**: Single screen, no scrolling, mobile-first
- **Colors**: Dark theme with glass effects and subtle gradients
- **Brand**: Must match CCCD's elite cosmetic dentistry positioning

## SEO/AIO Requirements
All pages must follow `pjbroome/seo-aio-standards-2026`:
- Perfect AIO head tags (meta, OG, Twitter, geo, JSON-LD)
- Atomic Answers (40-60 words) under question headers
- Full JSON-LD @graph (Organization + Dentist + Services)
- Structured data validation before deployment

## Related Repos
- **Backend**: `pjbroome/sutton-api` — Sutton conversational AI
- **VC Planning**: `pjbroome/cccd-virtual-consult` — Backend architecture
- **Standards**: `pjbroome/seo-aio-standards-2026` — SEO/AIO templates

## Rules
- Mobile-first: design for phone screens first, then scale up
- No-scroll: entire intake experience fits one screen
- Accessibility: WCAG 2.1 AA compliance
- Performance: Core Web Vitals must pass (LCP < 2.5s, CLS < 0.1)
- HIPAA: No PHI stored client-side, all data sent over HTTPS
- Follow existing component patterns — check `components/ui/` first
- Use Tailwind utilities, avoid custom CSS where possible

## Team
- **CEO**: Dr. Patrick Broome
- **Designer**: JJ (Claude COO agent)
- **Lead Dev**: Devin (app.devin.ai)

## MCP Connections (DO NOT ask for these — they are connected)
- GitHub, Supabase, Railway, HeyGen, E2B, YouTube, Mem0
