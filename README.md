# CCCD VC Platform

The complete Virtual Consultation platform for Charlotte Center for Cosmetic Dentistry —
consolidated monorepo.

| Sub-project | Description |
|---|---|
| [`frontend/`](frontend/) | Next.js — patient intake form, staff admin dashboard, slide deck builder + presenter |
| [`backend/`](backend/) | FastAPI — VC API (`/vc/*`, `/admin/*`, `/slides`), slide sorter, auth (+ Sutton chat backend, pending split) |

Imported with full git history from `cccd-vc-intake` and `sutton-api@vc-resume` on 2026-07-08.
See [CLAUDE.md](CLAUDE.md) for the full component map, deploy targets, and cutover checklist.
