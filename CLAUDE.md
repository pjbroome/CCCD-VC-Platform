# CLAUDE.md — CCCD VC Platform (consolidated monorepo)

## What this is
The **entire Virtual Consultation platform** for Charlotte Center for Cosmetic Dentistry in ONE
repo: patient intake, staff admin dashboard, slide library, and slideshow (deck) creation/
presentation. Consolidated 2026-07-08 on Patrick's order to end fractured work parked on
orphan `devin/*` branches — every Claude session must be able to see what goes with what.
Patrick is CEO — he does not code; Claude executes 100% of technical work.

## Sub-projects (what goes with what)
| Dir | What it is | Came from | Deploys as |
|---|---|---|---|
| `frontend/` | Next.js app: intake form (`app/page.tsx`), staff dashboard/login/feedback (`app/staff/*`), deck builder + presenter (`app/staff/[id]/deck`, `deck/present`) | `cccd-vc-intake` @ `fix/intake-photo-preview-and-fields` (subtree, history preserved) | Vercel (git-deploys) |
| `backend/` | FastAPI codebase: VC API (`/vc/*`, `/admin/*`, `/slides`) in `app/main.py` + `auth.py` + `slide_sorter.py` + `vc_slides/`; ALSO still contains the Sutton chat backend (`rag.py`, persona) | `sutton-api` @ `vc-resume` (subtree, history preserved) | **TWO Fly apps from one codebase:** `fly deploy -c fly.vc.toml -a cccd-vc-backend` (VC) · `fly deploy -c fly.toml -a sutton-api-watchdog` (Sutton chat) |

Frontend→backend contract: `frontend/lib/api.ts` → `https://cccd-vc-backend.fly.dev`
(`NEXT_PUBLIC_API_URL` override). Quirks: zip travels in the `city` field;
`consent_acknowledged` hardcoded true; `referral_source` not sent.

## ⚠️ CUTOVER NOT DONE — live systems still run from the OLD locations
This repo is the organized go-forward home, but as of 2026-07-08:
- Vercel still builds from `cccd-vc-intake` (branch preview URL is allowlisted in backend
  `CORS_ALLOWED_ORIGINS` AND Cloudflare Turnstile — a new deploy source = new hostname = broken
  submits until both allowlists are updated).
- Fly apps were last deployed from a `sutton-api` checkout.
- Patrick's other session is finishing the final platform build in `cccd-vc-intake`.

**Cutover checklist (needs Patrick's explicit go, coordinated with that session):**
1. `git subtree pull --prefix=frontend ~/code/cccd-vc-intake <final-branch>` to sync final work
   (same for backend if it moved)
2. Point Vercel project at this repo (`frontend/` root) — or create new Vercel project
3. Add the new Vercel domain(s) to backend CORS + Turnstile allowlists
4. Rotate `VC_ADMIN_PASSWORD` (still the dev value) — `fly secrets set VC_ADMIN_PASSWORD='…' -a cccd-vc-backend`
5. Deploy backend from `backend/`: `fly deploy -c fly.vc.toml -a cccd-vc-backend`
6. Archive `cccd-vc-intake` and the sutton-api `devin/*` + `vc-*` branches (read-only, never delete)

## Syncing until cutover
The old repos remain the active work surface until the final build lands. To refresh this repo:
`git subtree pull --prefix=frontend ~/code/cccd-vc-intake fix/intake-photo-preview-and-fields -m "sync frontend"`
`git subtree pull --prefix=backend ~/code/sutton-api origin/vc-resume -m "sync backend"`

## Commands
- Frontend dev: `cd frontend && npm install && npm run dev` (:3000)
- Backend dev: `cd backend && poetry install && uvicorn app.main:app --reload`
- Backend is Python/FastAPI — consult `~/.claude/rules/ecc/python/` before edits

## Hard rules
- Patient input is UNTRUSTED — no raw HTML render of patient fields; LLM-side injection guards
  live in the backend
- Sutton NEVER appears on the website or VC portal (real, consented patient photos only)
- NEVER log/expose PHI (HIPAA); no hardcoded keys (`fly secrets` / `.env`)
- Admin/staff surfaces are walled off from frontend work without a planning session
- Org doctrine: NO new work on orphan branches — work happens here, in the owning sub-project

## Related
- Obsidian project note: `Master Vault/Projects/VC Platform.md` — update at session end ("log it")
- Portfolio dashboard: `Master Vault/Projects/Project Portfolio.md`
- Deep state memory: `vc-platform-state` (allowlist coupling, staff login, backend quirks)
- Future split candidate: the Sutton chat backend inside `backend/` may move to its own project
  once the VC platform ships — decision pending, don't do it unasked
