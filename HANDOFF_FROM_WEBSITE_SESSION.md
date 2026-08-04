# Hand-off — what the DestinationSmile website session learned (2026-07-15)

_For the Claude session building the CCCD VC platform. This is context from the parallel
destination-smile-web + GA4 work so we stay aligned. Nothing here changes your build plan by itself —
it's what we now KNOW, plus a few integration points to wire when you're ready._

## The one big truth we proved with data
**IG → Virtual Consult is the practice's actual growth engine. The website is a bridge to the VC.**
GA4 (12-month) shows most website "traffic" is Direct (~61%) with ~7-second sessions — that's the
Instagram audience landing, tapping the VC button, and leaving *for the consult*. Those short sessions
are **conversions, not bounces.** BUT the old analytics never measured a single VC start — the VC
button just linked off-site (to `app.smilevirtual.com`) and GA4 saw nothing past the click. **The VC
funnel has been completely unmeasured.** Your platform is where we finally measure it.

## Integration points to wire into the VC platform (when ready)
1. **Analytics = the SAME property as the website.** The website now uses a Patrick-OWNED GA4 property:
   **Measurement ID `G-KMVS74RYDD`** (account "Charlotte Center for Cosmetic Dentistry", property
   "Destination Smile"). The VC platform will live on **`consult.destinationsmile.com`** — a SUBDOMAIN
   of the website — so if the VC platform loads the **same `G-KMVS74RYDD` tag**, GA4 stitches the full
   journey (site → VC → booked) into ONE session automatically. No cross-domain linking needed (same
   root domain). Just add the gtag with that ID.
2. **Fire funnel events** (so the admin dashboard's inbound/sent tracking is mirrored in analytics and
   we can see drop-off): suggested `vc_start` (already fires on the website CTA click), then on the VC
   platform: `intake_started`, `photo_uploaded`, `intake_completed`, `sim_generated`, `reply_sent`,
   `consult_booked`. Mark the meaningful ones as **Key Events** in GA4 so they count as conversions.
3. **Preserve UTM params.** The website tags social links (`utm_source=instagram|facebook|tiktok`,
   `utm_medium=social`). If a visitor arrives via IG and continues into the VC, keep those params on the
   handoff so attribution flows through (same GA4 property makes this automatic if the tag is present).
4. **The website's VC CTA target = `https://consult.destinationsmile.com/`** (set in the website as
   `CONSULT_URL`, overridable via `NEXT_PUBLIC_CONSULT_URL` for staging). The VC platform needs to be
   reachable there at cutover.

## Product context that should shape the VC build
- **"Contact" on the website = the Virtual Consultation.** GA4's top 404s are people hunting for a
  contact page (`/contact-us`, `/contactus`, `/get-in-touch` = ~54 dead hits/yr). Julie confirms she
  gets contact-form emails, calls the person, and walks them to the VC link — a manual redirect we want
  to eliminate. Design intent: the website's primary "contact" action routes into the VC intake, so
  contact-intent and VC-intent are the same funnel. The VC intake should feel like the natural front door.
- **SmileViz smile simulations are a big hit and belong INSIDE the VC reply flow.** Patrick uses SmileViz
  (photorealistic AI before/after from a patient photo, ~90 sec) and its owner offered an API. Plan for
  the VC platform to (a) generate a smile simulation from the uploaded patient photo and (b) include it
  with Dr. Broome's personal video reply. (A separate research pass is investigating what underlying
  engine SmileViz uses and whether Patrick can license it directly vs. taking their API — TBD.)
- **The VC platform's own pieces** (per Patrick): intake page + backend **Slide Library, Slide Builder,
  Video-reply Recorder, and admin Dashboard** tracking inbound + sent replies for follow-up. That admin
  dashboard is the operational heart — the GA4 funnel events above should complement it, not replace it.

## What the website session shipped today (so you're not surprised)
- Patrick-owned GA4 property `G-KMVS74RYDD` created; website wired to it; `vc_start` conversion event
  added to the site's consult CTAs; social UTM kit written.
- 301 redirect map completed; GA4 baseline + evidence archived; a congenial evidence email to the agency
  (Goldman) staged re: Search Console/GTM access.
- Full analysis lives in the website repo: `destination-smile-web/docs/ANALYTICS_BASELINE.md` and
  `docs/NEW_SITE_AND_VC_PLAN.md`.

## Open question for Patrick to decide
Whether the website-session Claude (me) dives into the VC platform's agent/back-end testing directly, or
you keep this as a two-track effort with this hand-off keeping both sides aligned. Either works.

---

## Dashboard / UX cues for the admin backend (from reviewing SmileViz + SmileVirtual, 2026-07-15)

**Stacks observed (for reference, not prescriptive):**
- **SmileViz** (the better‑designed competitor): React SPA (not Next.js), self‑hosted, LaunchDarkly
  (feature flags), Statsig (experimentation/analytics), Google OAuth. Image engine = **Google Gemini
  2.5 Flash Image** (confirmed via SynthID + "Google C2PA Core Generator Library" in the output file).
- **SmileVirtual** (the tool we're replacing): Next.js/React, generic purple template, heavy marketing
  stack (FB pixel, Hotjar, ActiveCampaign, ProductFruits). Patient page is templated/undistinguished.

**Steal these SmileViz dashboard patterns for our admin backend:**
1. **Group the sidebar nav by JOB, not feature** — SmileViz uses "Convert Patients" (New Simulation,
   Virtual Consultation, Self Simulation, Leads) vs "Manage Practice" (Simulations) vs "Account". Our
   nav should read as the daily workflow, not a feature dump.
2. **Status‑pill lifecycle on every consult row** — Not Sent → Ready to Start → Sent → Opened → Opened
   3× → Interested → Accepted. One glance = where each patient is. This is the single most useful
   pattern for a follow‑up‑driven practice.
3. **Engagement signals ("Opened", "Opened 3×")** — track whether the patient viewed the reply and how
   many times. That's the follow‑up prioritization gold (opened‑but‑not‑booked = hottest lead).
4. **A prominent primary action up top with a time estimate** — SmileViz: "Create a new simulation ·
   ~90 SEC". Reduces the "how long will this take" friction. Ours: "Record a reply · ~2 min".
5. **Card list with avatar‑initials + name + treatment + date + status** — instantly scannable; filters
   across the top (All Cases / Status / Treatment / Videos / Photos / Time) for fast triage.
6. **A prioritized "needs action" home** — new inbound awaiting reply, sent‑but‑not‑opened (nudge),
   opened‑but‑not‑booked (call). This turns the dashboard into a work queue, which is what Julie needs.
7. **Calm, light, generous‑whitespace theme** — but for CCCD, swap SmileViz's neutral look for the
   **warm ivory + muted‑gold luxury** palette (NOT SmileVirtual's generic purple). Concierge tone.

**Our unfair advantages to build in (things SmileViz/SmileVirtual can't do because we own it):**
- Smile‑sim (Gemini) generated INSIDE the reply flow and attached to Dr. Broome's video.
- Full funnel measured in Patrick's own GA4 (`G-KMVS74RYDD`) — inbound → opened → booked.
- The Slide Library / Slide Builder tie the "asked for X, chose Y" rescue‑case stories directly into
  the reply (a differentiator neither competitor has).

---

## UPDATE 2026-07-15 (later): engine CONFIRMED + working POC exists
- **Engine locked:** SmileViz's sims are Google **Gemini image models** — proven by SynthID + "Google
  C2PA Core Generator Library" inside their actual output file. Owner's "our own model" claim = false.
- **Working POC:** `~/code/smile-sim-poc/` (node server.js → http://localhost:4646). Upload photo →
  treatment preset (veneers/whitening/ortho/All-on-X) → Gemini edit → side-by-side. Identity-preserving
  prompt templates live in `public/index.html` (the tuning surface — port these into the VC platform).
- **Key:** `GEMINI_API_KEY_VC` in `~/.config/cccd/secrets.env` — from Patrick's ALREADY-BILLED Google
  project **"Gemini VC Photo project"** (Tier 1 postpay). ~$0.04/image. The plain `GEMINI_API_KEY` is
  free-tier (image gen blocked) — don't use it for images.
- **First result (synthetic face, no PHI): quality ≈ SmileViz** on `gemini-3.1-flash-image` (newer than
  SmileViz's 2.5) — 7.8s, identity fully preserved, natural veneers. Our output carries the same
  SynthID/C2PA markers as theirs (same engine, bidirectional proof).
- **Production TODO:** move to **Vertex AI under Google Cloud HIPAA BAA** before real patient photos
  become routine (plain API paid tier = not used for training, but no BAA).
