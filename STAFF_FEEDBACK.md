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
- **#2 had two root causes, both fixed:** (a) the consent error could never be cleared by checking the box (stale error-key bug) — moot now the checkbox is gone; (b) Cloudflare Turnstile tokens expire after ~5 min — slower fills were rejected by the backend as "Bot verification failed" despite a complete form. The token is now minted at submit time (after photo uploads) with one automatic fresh-token retry.
- **#4:** zip is stored in the backend's existing `city` field (no zip column yet); staff detail page shows it under "Zip Code". First/Last name kept — the video reply, confirmation email, and dashboard all address the patient by name.
- ⚠️ **Preview limitation:** the backend CORS allowlist only covers the production origin — the preview shows all UI changes but a live submit from the preview URL will fail. Options logged with Patrick (add preview origin to `CORS_ALLOWED_ORIGINS`, or submit-test after merge).
- Verified: tsc clean, 16-agent adversarial review (0 confirmed defects), retry path proven against a mock of the production 400, mobile 375px layout checked.

## Resolved
| # | Date | Area | Feedback | Fix / PR |
|---|------|------|----------|----------|
| — | | | _(items move here after staff re-test on the preview)_ | |
