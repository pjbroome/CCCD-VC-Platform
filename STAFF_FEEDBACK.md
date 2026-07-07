# VC Platform — Staff Frontend Feedback (living log)

Staff test the live evaluation platform and report frontend feedback here. Claude triages each item,
implements on a branch, deploys a **Vercel preview** for staff to re-review, then marks it resolved.
See `HANDOFF.md` for the full loop.

## Where staff test
- **Patient intake (front door):** https://destination-smile-consult.vercel.app/
- **Staff admin dashboard:** https://destination-smile-consult.vercel.app/staff  *(login required — password = `VC_ADMIN_PASSWORD`)*

## How to log an item
Add a row. Keep it specific: what screen, what you did, what happened vs. what you expected.
- **Area:** intake · staff-dashboard · deck-builder · recorder · consult-page · widget · copy · other
- **Severity:** blocker · high · medium · low
- **Status:** open → triaged → in-progress → preview-ready → resolved

## Open feedback
| # | Date | From | Area | Feedback (what / expected) | Severity | Status | Preview / PR |
|---|------|------|------|-----------------------------|----------|--------|--------------|
| — | | | | _(no open items — round 1 shipped 2026-07-01)_ | | | |

### Triage notes (items 1–4, 2026-07-01)
- **#2 ROOT CAUSE FOUND (verified on live production, 2026-07-01):** the Cloudflare Turnstile **site key's domain allowlist does not include `destination-smile-consult.vercel.app`** — the invisible bot-check widget throws `Error: 110200` (domain not allowed) on every production page load, no verification token is ever minted, and the old code then demanded "Please complete the verification below" with nothing visible to complete. **Every production submit failed this way.** **FIXED 2026-07-01 (Claude, via Patrick's browser session):** the widget's allowlist had only `localhost` + the wrong Vercel *project* alias (`cccd-vc-intake-pjbroome-7395s-projects.vercel.app`) — never the real production domain. Both `destination-smile-consult.vercel.app` and the branch-preview hostname are now added (originals untouched). Verified live: production mints tokens (no more 110200), and a full end-to-end submit from the preview succeeded — request **#5** ("TEST Claude E2E", clearly marked, safe to delete from the dashboard). Two code-level defenses also shipped in PR #26: (a) the stale consent error-key bug is gone with the checkbox; (b) tokens are now minted at submit time with one automatic fresh-token retry and a clear, recoverable error message if the widget fails.
- **#4:** zip is stored in the backend's existing `city` field (no zip column yet); staff detail page shows it under "Zip Code". First/Last name kept — the video reply, confirmation email, and dashboard all address the patient by name.
- ✅ **Preview CORS fixed (Patrick-approved, 2026-07-01):** preview origin added to `CORS_ALLOWED_ORIGINS` on Fly; preflight verified for both preview and production. Preview submits now reach the backend — they complete once the Turnstile domain fix (above) is in.
- Verified: tsc clean, 16-agent adversarial review (0 confirmed defects), retry path proven against a mock of the production 400, mobile 375px layout checked.

## Round 2 — conversion-psychology redesign (2026-07-06, preview-ready)
Built from the new `conversion-ux` skill (20-video UX intelligence corpus). **All round-1 staff features kept.**
- Progress bar that starts at 20% and fills to "Ready to send" (motivation: people finish what feels underway)
- Tap-to-answer concern chips — typing now optional ("Whiter smile", "Full smile makeover", …)
- Warmer copy + gold/cream luxury look; trust chips (100% free · 2–3 min · personal video); CTA "Get My Video Consultation"
- Accessibility: 44px tap targets, focus rings, reduced-motion support
- Preview for staff: https://cccd-vc-intake-git-fix-intake-ph-279282-pjbroome-7395s-projects.vercel.app (full submits work here)

**Round-3 shipped same day (Patrick's "go on all," 2026-07-06):** goals-first step order ("What would you love to change?" opens the form; contact details last under "Where should we send your video?") · referral dropdown → tappable pills · numeric progress label ("2 steps left" → "Ready to send"). **Still queued:** Dr. Broome photo + checkpoint timeline on the thank-you screen (needs a headshot asset + Patrick's pick).

## Owner feedback round (Patrick, 2026-07-06) — SHIPPED to preview same day
Feedback → fix, all verified live:
- "Sections have no separation / one big page" → **three separate white cards** on an ivory background with real gaps
- "Top too busy; drop practice name" → header is now just the title + gold hairline + one line (practice name only in invisible SEO metadata)
- "Copy says photos but they're step 2 / make it 3 easy steps" → order is now **1 Your details · 2 What would you love to change? · 3 Add your photos**, subline says "Three easy steps"
- "Remove How did you hear about us" → removed entirely (field, payload, everything)
- "Remove text under CTA; big green Submit" → big emerald **Submit** button, zero copy beneath
- "Gold alone looks cheap; more interesting color" → **deep emerald primary + ivory atmosphere**, gold reduced to one hairline accent under the title

## Owner feedback round 2 (Patrick, 2026-07-06) — SHIPPED to preview
- Subline now reads exactly "3 easy steps"
- "Whiter smile" chip pre-selected (form arrives with one answer already given — progress starts at 31%)
- Extra photos hidden behind an "+ Add · optional" button; tapping reveals a clean 4-slot grid (section 3 stays minimal)
- Color now has meaning: green = GO only (Submit, progress, done-checks) · ink = selections · neutral chrome elsewhere · single gold hairline

## Owner feedback round 3 (Patrick, 2026-07-06) — SHIPPED to preview
- Selection pills now smoked-glass (gradient + sheen + blur) instead of flat black
- Green removed from everything except the Submit button (progress bar + badges + checks now ink)
- Photo boxes replaced with fun line-art invitation cards: face-in-viewfinder sketch and sparkling-smile sketch (gold sparkle accents)
- Extra photos: single "+ Add · optional" button that opens the picker directly — zero empty boxes on screen ever
- Submit button sized to its word, centered
- Progress label now counts the 3 promised steps (was counting 7 field milestones — "3 easy steps" header vs "6 steps left" read as a contradiction; Patrick 2026-07-07). Bar still fills per field for smooth goal-gradient feedback; fresh page reads "31% · 2 steps left" ("Smile Upgrade" pre-select completes Step 2)
- Input fields were washed out on white (Patrick 2026-07-07): borders zinc-200→zinc-400, white field bg + inset shadow ("well" look), placeholders + labels one shade darker — verified desktop + mobile
- "Not sure — show me my options" → **"Other — I'll explain"** (same behavior: exclusive, requires a note in the text box)
- Free-text box hardened against prompt injection: 300-char hard cap (maxLength + JS + submit-time), control/invisible/bidi characters stripped (the text feeds AI-assisted review downstream); tiny "N characters left" counter appears near the limit
- Unselected chips lifted off the card (Patrick 2026-07-07): white pill + zinc-300 border + soft drop shadow — raised "tap me" buttons, deliberately opposite to the sunken input wells; hover darkens border + deepens shadow
- **Gradient progress bar** (Patrick 2026-07-07): fill reveals a fixed ink→gold→emerald spectrum (counter-scale, compositor-only) — the bar literally reaches GO-green at "Ready to send"; gentle shimmer sweep (reduced-motion aware); completion = emerald label + soft glow
- **Conversion-ux audit round** (Patrick: "recommit to using that info" — 6-dimension agent audit of the page against MASTER_GUIDE/CHECKLISTS, 36 findings → 12 taste-gated → 9 applied):
  - Card headers re-ranked: STEP N overline + the human question as hero type (text-lg/xl) — the page scans instead of reading dense-utility
  - Spacing rhythm: real gaps between cards (gap-5/6, p-5/7) — tight within units, wide between
  - Optional note now behind a "+ Add a note · optional" pill (last empty box gone); "Other — I'll explain" auto-opens + focuses it
  - Note pill collapses back on blur if left empty (Patrick 2026-07-07) — no lingering empty box; stays open if text is present or "Other" requires it
  - Raw browser network errors ("Failed to fetch"/"Load failed") now translate to a human retry message; nothing entered is lost
  - Photo frames shaped to their photo (Patrick 2026-07-07): Full Face = portrait, Close-up Smile = wide; uploaded photos auto-frame — full photo contained (never cropped) over a soft blurred self-backdrop that fills the frame. Verified portrait/wide/wrong-orientation cases + empty-state sketches, desktop + mobile
  - Balanced photo row, round 2 (Patrick 2026-07-07: smile box read too large): equal-width columns, smile vertically centered beside the taller selfie; overlay labels stacked so nothing truncates
  - Balanced photo row, round 3 (Patrick 2026-07-07): selfie box trimmed 4:5 → 7:8 so the gold viewfinder sketch fills its frame; contain-fit re-proven with border-marked test photos (all four edges visible = zero cropping), desktop + mobile
  - **Staff-side photo expand/zoom = requested by Patrick, NOT yet built** (verified: staff detail page shows fixed-height cropped `object-cover` thumbs, click does nothing except hover-Edit) — admin surface, needs the planning-session treatment before code
  - Safari "not authorized" report resolved: that tab was on a non-allowlisted deployment-hash URL — the diagnostic layer named it correctly; official branch/production links work (verified live probe from Patrick's Chrome)
  - Dead-tap fixed: invalid submit scrolls to + focuses the first errored field (was a silent no-op); errors fade in
  - iOS zoom killed: 16px input text on mobile (~50px fields); 44px hit areas on rotate/remove buttons; extras thumbs size-16
  - Legibility: 9-10px micro-type raised to 11-12px, muted grays lifted one tone, "Dr. Patrick Broome · Charlotte, NC" footer now readable
  - Ambient emerald purged from page/success backgrounds (green = GO only; canvas is now one warm champagne field)
  - Photo reward moment: photo fades/settles in + check badge springs in (was a hard cut)
  - Step 3 discretion signal: "Private — for your consultation only" (answers the photo objection where it forms; worded to be TRUE — staff also see photos, so no "only Dr. Broome" claim)
- **Audit items held for Patrick's call:** CTA rename "Submit" → "Send to Dr. Broome" (checklist flags "Submit" as critical fail, but Patrick explicitly chose "Submit"); step reorder aspiration→photos→details (biggest conversion lever, structural); sticky progress bar + thumb-zone sticky CTA on mobile (structural)

## Housekeeping notes
- **Orphan photo on the volume (needs a human call):** `patient_photos/e0902fdd52d04acc905b12101a70e8df.jpg` (373 KB, uploaded 2026-07-02 00:28 UTC) is referenced by **no** intake request — almost certainly from a staff member's submission that failed on the old bot-check bug (photo uploaded, request rejected). It may be a real person's photo, so Claude left it in place. Delete via `fly ssh console -a cccd-vc-backend -C "rm /data/vc/patient_photos/e0902fdd52d04acc905b12101a70e8df.jpg"` or keep.
- Claude's own orphan test PNG was removed 2026-07-05; all remaining photos are referenced by live requests.
- Test record **#5** ("TEST Claude E2E") remains in the dashboard as a worked example — delete anytime.

## Resolved
| # | Date | Area | Feedback | Fix / PR |
|---|------|------|----------|----------|
| 1 | 2026-07-01 | intake | Can't see uploaded pics | Live photo thumbnails in the upload boxes — [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26), **merged to production 2026-07-01** |
| 2 | 2026-07-01 | intake | Error though all fields complete + consent box checked | Root cause: Turnstile site-key domain allowlist lacked the production domain (Error 110200) → fixed in Cloudflare; plus stale consent-error bug and submit-time token hardening in [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26). Verified E2E (request #5) |
| 3 | 2026-07-01 | intake | Remove consent checkbox + data statement | Removed — [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26), merged |
| 4 | 2026-07-01 | intake | Drop DOB; zip instead of city | Done (required 5-digit zip, numeric keypad; stored in city field) — [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26), merged |
