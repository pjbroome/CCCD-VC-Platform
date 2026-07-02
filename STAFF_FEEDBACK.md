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
| 1 | 2026-07-01 | Staff (via Patrick) | intake | Can't see uploaded pics — want the image visible in the photo box | medium | preview-ready | [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26) · [preview](https://cccd-vc-intake-git-fix-intake-ph-279282-pjbroome-7395s-projects.vercel.app) |
| 2 | 2026-07-01 | Staff (via Patrick) | intake | Error as if a required field was missing, though every field was complete and the consent box checked | high | preview-ready | [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26) · [preview](https://cccd-vc-intake-git-fix-intake-ph-279282-pjbroome-7395s-projects.vercel.app) |
| 3 | 2026-07-01 | Patrick | intake | Remove the consent checkbox + entire data-collection statement | medium | preview-ready | [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26) · [preview](https://cccd-vc-intake-git-fix-intake-ph-279282-pjbroome-7395s-projects.vercel.app) |
| 4 | 2026-07-01 | Patrick | intake | Drop Date of Birth; collect Zip instead of City — email + cell + zip is enough demographics | medium | preview-ready | [PR #26](https://github.com/pjbroome/cccd-vc-intake/pull/26) · [preview](https://cccd-vc-intake-git-fix-intake-ph-279282-pjbroome-7395s-projects.vercel.app) |

### Triage notes (items 1–4, 2026-07-01)
- **#2 ROOT CAUSE FOUND (verified on live production, 2026-07-01):** the Cloudflare Turnstile **site key's domain allowlist does not include `destination-smile-consult.vercel.app`** — the invisible bot-check widget throws `Error: 110200` (domain not allowed) on every production page load, no verification token is ever minted, and the old code then demanded "Please complete the verification below" with nothing visible to complete. **Every production submit failed this way.** **FIXED 2026-07-01 (Claude, via Patrick's browser session):** the widget's allowlist had only `localhost` + the wrong Vercel *project* alias (`cccd-vc-intake-pjbroome-7395s-projects.vercel.app`) — never the real production domain. Both `destination-smile-consult.vercel.app` and the branch-preview hostname are now added (originals untouched). Verified live: production mints tokens (no more 110200), and a full end-to-end submit from the preview succeeded — request **#5** ("TEST Claude E2E", clearly marked, safe to delete from the dashboard). Two code-level defenses also shipped in PR #26: (a) the stale consent error-key bug is gone with the checkbox; (b) tokens are now minted at submit time with one automatic fresh-token retry and a clear, recoverable error message if the widget fails.
- **#4:** zip is stored in the backend's existing `city` field (no zip column yet); staff detail page shows it under "Zip Code". First/Last name kept — the video reply, confirmation email, and dashboard all address the patient by name.
- ✅ **Preview CORS fixed (Patrick-approved, 2026-07-01):** preview origin added to `CORS_ALLOWED_ORIGINS` on Fly; preflight verified for both preview and production. Preview submits now reach the backend — they complete once the Turnstile domain fix (above) is in.
- Verified: tsc clean, 16-agent adversarial review (0 confirmed defects), retry path proven against a mock of the production 400, mobile 375px layout checked.

## Resolved
| # | Date | Area | Feedback | Fix / PR |
|---|------|------|----------|----------|
| — | | | _(items move here after staff re-test on the preview)_ | |
