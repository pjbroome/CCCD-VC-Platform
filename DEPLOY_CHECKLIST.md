# CCCD VC Portal — Go‑Live Checklist

**Status: built, deployed, and verified end‑to‑end.** Everything below is code‑complete.
Going live = flipping on the paid/account items in this list. Nothing here bills until you say go.

- Frontend (Vercel): `https://v0-kleon-samples.vercel.app` (custom domain at go‑live)
- Backend (Fly): `cccd-vc-backend` (`https://cccd-vc-backend.fly.dev`)
- Widget install guide for Goldman: `WIDGET_INSTALL.md`

## ✅ Verified working (live)
Patient intake (+ widget popup), referral + source capture, photo upload (2 required + 4 optional),
honeypot + rate‑limiting + upload validation, staff login (enforced), dashboard (search, photo
thumbnails, video‑seen badge, Add Patient), slide library (145), deck builder, recorder, create
consultation, **patient‑notify email (link verified; fires when key added)**, token patient video
page, watch/play tracking, CORS lock, security headers, path‑traversal guard, persistent sessions,
PHI on volume.

## 🔧 Go‑live steps (each is a flip; I run the commands)

### 1. Email — so patients receive their video link
Pick one and give me the credentials; I set the Fly secrets:
- **Resend (recommended, free 100/day):** create account → verify `destinationsmile.com` as sender → API key.
  `fly secrets set RESEND_API_KEY=… EMAIL_FROM=info@destinationsmile.com PUBLIC_BASE_URL=https://<portal> -a cccd-vc-backend`
- **Practice SMTP:** give host/user/pass → `fly secrets set SMTP_HOST=… SMTP_USER=… SMTP_PASS=… EMAIL_FROM=info@destinationsmile.com …`

### 2. Storage — pick at go‑live (suggestions)
At ~20/day you'll write ~20 GB/mo (photos + video). Options:
- **Extend Fly volume + 90‑day video retention (simplest, covered by Fly BAA):** `fly volumes extend <id> -s 100 -a cccd-vc-backend`; I enable `VIDEO_RETENTION_DAYS=90`.
- **AWS S3 + BAA (scales forever):** I build the S3 upload/serve adapter; you sign the AWS BAA.

### 3. Fly machine — reliability for video uploads
`fly scale memory 1024 -a cccd-vc-backend` (512→1024 MB). Optional always‑on (no cold start): set `min_machines_running = 1` in `fly.vc.toml`.

### 4. Fly BAA — HIPAA (the one true paid gate) — ~$99/mo
Sign via Fly dashboard → covers the box + volume where PHI lives.

### 5. Vercel — commercial use
Upgrade to **Pro** ($20/mo) for commercial use. (Frontend handles photo uploads in transit; the
heavy PHI lives on Fly. Revisit a Vercel BAA if counsel requires it.)

### 6. Cloudflare Turnstile (optional, free) — bot challenge on intake
Create a free Turnstile key → I wire `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend) + `TURNSTILE_SECRET`
(backend verify). Honeypot + rate‑limit already protect the form without it.

### 7. Custom domain (when ready)
Point e.g. `consult.destinationsmile.com` → Vercel. I update `PUBLIC_BASE_URL`, CORS, and the widget
URL; you give Goldman the one‑line URL swap in `WIDGET_INSTALL.md`.

### 8. Hand Goldman the widget
Send `WIDGET_INSTALL.md` (Option B floating widget recommended). Remove the old Smile Virtual embed.

## Capacity (10–20+/day)
Trivial compute load. Real limits: storage (step 2), email rate (Resend free 100/day covers it),
machine RAM for large video uploads (step 3). All addressed above.

## Staff access
Staff log in at `/staff`. Password is the `VC_ADMIN_PASSWORD` Fly secret (rotate anytime via
`fly secrets set VC_ADMIN_PASSWORD=…`).
