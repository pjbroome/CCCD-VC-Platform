# Phase 2 — AI Deck-Assembly Agent (Spec for Review)

_Drafted 2026-06-22 by Claude for Dr. Broome's review. **This is a design proposal + open questions, not built yet.** Phase 1 (the working, hardened VC platform) is the prerequisite; this is the "AI agents inside the backend" you always planned to come back for._

## Goal (in your words)
> "AI agents inside the backend slide library that read the inbound images and assemble the slide show like I do, ready for me when I log in to record the video reply."

So: **staff-side, human-in-the-loop.** The agent prepares a *draft* deck; **you** always review, edit, and record. No patient-facing AI, no clinical claims generated to patients → **no hallucination risk to patients.** It just saves you the assembly time.

## What it builds on (already exists)
- Backend slide endpoints: `/vc/slides/search`, `/vc/slides/match`, `/vc/presentation`, `/recording-decks`, plus `indexed_catalog.json` (155-file slide catalog) and the drag-and-drop deck builder.
- The dormant **Sutton RAG/chat** in the same backend (`/chat`, `/rag`) — currently **disconnected** (`/healthz`: LLM providers off). Reconnecting it (grounded) is the reasoning engine.
- The intake already captures photos + the patient's concern text per request.

## Proposed flow (per inbound consult)
1. **Image analysis** — a vision model reads the patient's photos → structured findings (spacing/gaps, discoloration, wear/chips, missing teeth, gummy smile, crowding, etc.).
2. **Case classification** — map findings + concern text → likely treatment path(s) (veneers · whitening · implants/All-on-X · bonding · Invisalign · gum therapy), **grounded in your actual case history** (see training data).
3. **Deck assembly** — select + order slides from the catalog that match the case (intro → relevant before/afters → treatment explanation → close), i.e. "assemble it like you do." Output = a draft deck attached to that request.
4. **(Optional) talking-point notes** — suggest a starting script from your past consult patterns, so you're not starting cold.
5. **Queue for you** — the request shows **"AI-drafted deck ready"** in the dashboard; when you log in, it's pre-built. You review/adjust/record. Done.

## Grounding / anti-hallucination (addresses your past Sutton concern)
- The agent **only selects from your approved slide catalog** + suggests from **your own prior consults** (RAG) — it does not invent clinical content.
- The deck is a **draft you approve**; nothing reaches a patient without you.
- Confidence-gated: low-confidence cases flag "needs manual build" rather than guessing.

## Training / grounding data
- **Devin's 1,000+ Vimeo consults** are the gold signal — they encode *case → which slides you used → what you said*. Processing them into a **case→deck mapping** is what teaches the agent your patterns.
- ⚠️ **Location unknown** (not in Dropbox; likely still on Vimeo or a Devin workspace). **Phase 2a = locate + extract** (transcripts + slide-usage), likely via Devin directly. We may need only the **transcripts + deck mappings**, not the raw video files.

## HIPAA note (this processes PHI — patient photos)
The vision/LLM models see patient photos = PHI → must be **BAA-covered**. Options: **Claude (Anthropic BAA)**, **Gemini (Google Cloud BAA)**, or **Azure OpenAI**. This ties into the [[HIPAA_GO_LIVE_PLAN]] and the existing HIPAA model-routing decision. Pick the BAA-covered model before building Step 1.

## Phasing
- **2a** — Locate + process the Vimeo corpus (transcripts + case→deck mappings); reconnect the RAG (grounded).
- **2b** — Image analysis + case classification (BAA-covered vision model).
- **2c** — Deck-assembly draft + "ready" queue in the dashboard.
- **2d** — *(optional)* talking-point note drafting.

## Open questions for Dr. Broome (the decisions)
1. **Ambition for v1:** start simple (case-type → template deck you refine) and improve, or go straight for learned-from-your-history assembly (needs the Vimeo corpus first)?
2. **Talking-point notes** — want them, or deck-only?
3. **Which BAA-covered model** for image analysis (Claude / Gemini / Azure)?
4. **Vimeo corpus** — okay to have me query Devin directly to find/extract it?
5. **Sutton separation** — keep the AI in the shared backend, or split Sutton into its own service first (cleaner) before adding this?

_No build starts on Phase 2 until you green-light scope + the model. Phase 1 go-live (BAAs + storage) comes first._
