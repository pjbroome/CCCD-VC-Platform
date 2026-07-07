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
