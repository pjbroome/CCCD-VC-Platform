# VC Portal — Pre‑Release Testing Access

Two audiences, two links. (Current URL is the Vercel staging URL; swap for
`consult.destinationsmile.com` when you point the domain.)

Base URL: **https://destination-smile-consult.vercel.app**

---

## 1) Patients / staff / friends — test the patient experience
**Link to share:** https://destination-smile-consult.vercel.app/

They use it exactly like a real patient: tap **Get Started / Submit Photo**, fill
the form, upload a smile photo (+ optional extras), submit. Their request lands in
your admin dashboard for the team to reply to.

**Feedback survey (auto-linked after they submit, or share directly):**
https://destination-smile-consult.vercel.app/feedback
~60 seconds: ease, photo upload, clarity, trust, comfort, NPS, and open suggestions.

> Copy‑paste invite:
> "We built our own virtual smile‑consult tool and I'd love your honest take before
> we go live. Try it here on your phone: <link> — submit a quick photo like a real
> patient, then the 60‑second survey at the end. Brutal honesty welcome!"

---

## 2) Office manager — full admin backend
**Link:** https://destination-smile-consult.vercel.app/staff
**Password:** (the staff password I set — share securely, not in email)

She gets the full backend:
- **Patient Dashboard** — every request, search, photo thumbnails, status, "Video Seen"
- **Add Patient** — log phone/walk‑in inquiries
- **View Profile** → patient photos (rotate/zoom), info, referral source
- **Build Deck** — slide library + deck builder
- **Record** — screen + camera video reply, then **Send** to the patient
- **Tester feedback** (sidebar) — read all survey responses with averages
- Follow‑up: update status, resend, answer questions

You and she share the same login for now (single staff password). The recorder
needs Chrome screen‑share permission the first time.

---

## Notes for testing
- There are a few **sample/test entries** already in the dashboard (from build
  verification) — safe to ignore or delete.
- Real submissions during testing are real end‑to‑end (photos stored, emails fire
  only once an email key is added). Patients won't get an email link until go‑live
  email is configured — fine for UX testing; tell testers replies are simulated.
- Capacity is plenty for 10–20+/day.
