# VC Platform — Go-Live Plan (DestinationSmile.com cutover)

_Drafted 2026-08-02 from a live audit of the backend, frontend, DNS state, and the existing
[HIPAA_GO_LIVE_PLAN.md](HIPAA_GO_LIVE_PLAN.md) (which remains the legal/BAA authority). Goal: replace the
SmileVirtual link on DestinationSmile.com (`smilevirtual.com/Dr-Patrick-Broome/sign-up`) with our intake form,
safely, for real patient use._

**Owner tags:** 🧑‍⚕️ = Patrick must do it (legal/identity/vendor/spend) · 🤖 = Claude builds it · 🤝 = Claude preps, Patrick runs one command.

---

## What is ALREADY in place (verified at source 2026-08-02)

- ✅ TLS forced end to end (Fly `force_https`); Fly volume **encrypted at rest**
- ✅ Staff auth: bearer tokens (24h expiry), login rate-limited 8/min/IP, timing-safe compare, PBKDF2 path ready
- ✅ Public-endpoint rate limits: intake 12/min/IP · photo upload 30/min · feedback 10/min
- ✅ Cloudflare Turnstile bot gate on submission (server-verified) with self-diagnosing errors + auto-retry
- ✅ Prompt-injection defense on free-text (300-char cap, control/zero-width/bidi strip) + backend field caps
- ✅ PHI audit logging (`phi_audit` middleware → volume `audit.log`)
- ✅ Media URL signing SHIPPED (HMAC, 30-day expiry) — enforcement flag not yet flipped (Phase 2)
- ✅ Security headers, fail-closed auth when `VC_ENV=production`, unguessable media filenames
- ✅ One always-warm machine (no cold start), 250-request concurrency ceiling (plenty for 10–15/day)
- ✅ Retention endpoint + audit trail built; GitHub Action written (currently dormant — Phase 2)
- ✅ CORS locked to the production + preview origins only (verified via preflight)

## Known gaps found in this audit

| Gap | Risk | Fix phase |
|---|---|---|
| Volume is **1 GB** | fills in days once real photo/video volume starts → submissions fail | 2 |
| Admin password is a shared dev-grade value, plaintext secret | brute-forceable / no rotation hygiene | 2 |
| `MEDIA_ENFORCE_SIGNED` not flipped | photo/video URLs work without signatures (still unguessable, but weaker) | 2 |
| Retention cron not actually scheduled (workflow sits on a non-default branch; repo secret missing) | videos accumulate forever = growing PHI liability | 2 |
| `/staff` pages inherit `index: true`; no robots.txt | staff login discoverable in search engines | 3 |
| No uptime monitoring/alerting on the backend | silent outage = lost patients | 5 |
| TEST records + test artifacts still in the production dataset | clutter + confusion in real triage | 4 |
| No BAAs signed (Fly, Resend) | HIPAA legal exposure — **the** go-live blocker | 1 |
| GA4 absent from the intake app | the IG→VC funnel stays invisible (today's #1 measurement gap) | 3 |

---

## Phase 0 — Decisions (🧑‍⚕️, ~5 minutes, unblocks everything)

1. **Launch URL.** DNS for destinationsmile.com is mid-transfer (Kinsta/Route53 → GoDaddy, net-zero so far,
   watchdog armed). Adding `consult.destinationsmile.com` requires touching the ACTIVE zone that Goldman's tech
   still effectively controls. **Recommendation: launch on `destination-smile-consult.vercel.app` now (zero DNS
   dependency), add `consult.destinationsmile.com` after the DNS cutover lands in Patrick's GoDaddy/Cloudflare.**
   The link swap on the website is one href either way.
2. **Video storage.** Stay on the Fly volume (covered by the Fly BAA, simple) vs AWS S3+Glacier (cheaper at scale,
   needs an AWS account + BAA). **Recommendation: Fly volume for launch; revisit S3 at ~50 GB.**
3. **Retention window.** Confirm `VIDEO_RETENTION_DAYS=90` (HIPAA data-minimization default in the plan).

## Phase 1 — Legal layer (🧑‍⚕️, can run in parallel with 2–5, BLOCKS the final flip)

1. **Sign the Fly.io BAA** — https://fly.io/dashboard/personal/compliance (pre-signed by Fly; countersign).
2. **Resend BAA or PHI-free email** — verify whether the Resend plan offers a BAA. If not (likely on standard
   plans): 🤖 Claude strips the notification email to zero-PHI (generic "your reply is ready" + tokenized link,
   no first name) — then no Resend BAA is needed. Decide which path; the strip is a 30-minute build.
3. **Breach-notification one-pager** — 🤖 Claude drafts (who's notified, when, how, HHS 60-day rule);
   🧑‍⚕️ Patrick approves and files it in the Vault.

## Phase 2 — Backend production hardening (🤝, ~1 hour total)

Order matters inside this phase:

1. 🤖 Verify every frontend media fetch uses the signed URLs the API returns (dashboard, detail, deck, presenter).
2. 🤝 **The one secrets command** (Claude preps exact values, Patrick pastes — auto-mode blocks Claude from Fly
   secret writes). One shot sets: `VC_ADMIN_PASSWORD_HASH` (new STRONG password, PBKDF2), `VIDEO_RETENTION_DAYS=90`,
   `MEDIA_ENFORCE_SIGNED=1`, `VC_ENV=production`.
3. 🤝 Extend the volume: `fly volumes extend vol_4qlz5gdmz9w3nddr -s 20 -a cccd-vc-backend` (1 GB → 20 GB, ~$3/mo).
4. 🤖 Verify login with the hash, then 🤝 `fly secrets unset VC_ADMIN_PASSWORD` (removes plaintext).
5. 🤖 Activate the retention cron: move `vc-cleanup.yml` onto a default branch that GitHub Actions actually runs
   (cccd-vc-intake main), set the `CRON_SECRET` repo secret, fire a manual run, confirm a 200 in the audit log.
6. 🤖 Verify Fly daily volume snapshots are on (default 5-day retention) — our backup layer.
7. 🤖 Full security re-test matrix (auth fail-closed, unsigned media rejected, rate limits, CORS, Turnstile).

## Phase 3 — Frontend hardening + measurement (🤖, ~1 hour)

1. `noindex` on all `/staff*` routes + `robots.txt` (index the intake page, disallow staff).
2. GA4 tag `G-KMVS74RYDD` (Patrick's own property) on the intake app; fire `vc_start` (first field touched) and
   `vc_submit` (success) events. 🧑‍⚕️ Later: mark `vc_submit` as a Key Event in GA4 (2 clicks, Claude provides path).
3. Confirm production copy/links final (Sutton examples, trust line, footer — already owner-approved).

## Phase 4 — Data hygiene (🤖, 15 minutes)

1. Delete TEST records #4/#5, the orphan volume photo, and any browser-test artifacts from today's QA.
2. Confirm the remaining records are known/expected before real traffic mixes in.

## Phase 5 — Reliability watch (🤖, ~30 minutes)

1. Health watchdog on `https://cccd-vc-backend.fly.dev/healthz` + the production form URL every 5 minutes
   (GitHub Action, same Resend-alert pattern as the DNS watchdog — no new tools, no spend). Alert to pjbroome@gmail.com.
2. Documented rollback: the old SmileVirtual URL is recorded here — restoring the old link is a 1-line website edit;
   backend/frontend rollbacks are `git revert` + push.

## Phase 6 — The website flip (🧑‍⚕️ + Goldman, LAST STEP, after 1–5 are green)

1. Replace the VC button href on DestinationSmile.com:
   `https://app.smilevirtual.com/Dr-Patrick-Broome/sign-up` → the launch URL from Phase 0.
   The old site is Goldman-managed WordPress → email Danielle the exact old/new URLs (Claude drafts the email),
   or edit directly if WP admin access exists. Keep target="_blank" behavior.
2. Keep the SmileVirtual account alive 2–4 weeks as fallback, then decommission it (stops that spend).
3. Optional same-request ask to Goldman: sweep ALL SmileVirtual links site-wide, not just the homepage button.

## Phase 7 — Launch-day verification (🤖, launch day)

1. Live end-to-end test as a "patient": phone + desktop submission with photos through the REAL flow.
2. Staff flow test: triage → deck → record → send; patient receives the email; tokenized link plays.
3. Verify audit-log entries, signed-media enforcement, clean 404s, rate-limit headers.
4. 48-hour watch: submission count vs SmileVirtual baseline; watchdog quiet; volume usage sane.

---

## Critical-path summary

```
Phase 0 decisions (5 min) ──► Phase 2+3+4+5 build (Claude, ~1 day) ──► Phase 7 dry run
        │                                                                    │
        └── Phase 1 BAAs (Patrick, parallel — pace set by vendor) ──────────┘
                                                                             ▼
                                              Phase 6: flip the link on DestinationSmile.com
```

**The only hard blockers for real-patient traffic:** Fly BAA signed · Resend BAA-or-PHI-free-email resolved ·
Phase 2 secrets command run. Everything else is same-day Claude work.
