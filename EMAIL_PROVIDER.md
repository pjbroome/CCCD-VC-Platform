# 🔒 Email provider — AWS SES only. Resend is REVOKED.

**Decision date:** 2026-08-05 · **Decided by:** Dr. Patrick Broome · **Status: BINDING**

## The rule

**All transactional email from this platform goes through AWS SES.**
**Resend must not be reintroduced. Do not add `RESEND_API_KEY` back to any app.**

## Why — this is a compliance boundary, not a preference

Charlotte Center for Cosmetic Dentistry is a **HIPAA-covered entity**. A message naming an
identified person and tying them to a dental consultation is **protected health information**,
so the service that transmits it is a business associate and must be under a **BAA**.

| Provider | BAA | Verdict |
|---|---|---|
| **AWS SES** | ✅ signed and **Active** (account `133381932958`, via AWS Artifact) | **Use this** |
| **Google Workspace** | ✅ accepted — used when staff send a link by hand from `info@destinationsmile.com` | Fine |
| **Fly.io** | ✅ signed (hosts the backend) | Fine |
| **Resend** | ❌ **none, and none offered** | 🚫 **Prohibited** |

Sending patient email through Resend would put PHI in the hands of a processor with no BAA.
That is the whole reason it is gone.

## What was wrong with it in practice, beyond the BAA

Discovered while auditing the live platform on 2026-08-03:

1. **It sent from `onboarding@resend.dev`** — Resend's *shared* onboarding sender, used by every
   trial account on the platform. A prospective patient who has just uploaded photos of their
   face received a reply from a domain they had never heard of. That reads as phishing.
2. **It could only deliver to the Resend account owner.** That is why the test emails arrived
   for `pjbroome@gmail.com` and why a real patient almost certainly would not have received
   theirs. **Resend was never actually a working patient channel** — it only looked like one
   because the sole recipient was the account owner.
3. **Replies went nowhere.** The copy said "reply to this email"; replies to `resend.dev` reach
   no one at the practice.

## Current configuration (verified live 2026-08-05)

- Send path: `_send_review_email()` → `app/email.py::send_email()` → **AWS SES** (`us-east-2`)
- `EMAIL_FROM` — verified sending identity
- `REPLY_TO_EMAIL` = `info@destinationsmile.com` (Julie monitors it)
- `REVIEW_EMAIL` = `drbroome@destinationsmile.com` — internal notice carrying PHI, so a
  **Workspace** mailbox. It has **no default**: if unset the send fails closed rather than
  quietly leaking to a consumer address.
- `SECURITY_ALERT_EMAIL` = `pjbroome@gmail.com` — infrastructure signal only (visitor IPs,
  user agents). No PHI, so the fast-access Gmail is correct here.
- `RESEND_API_KEY` — **removed from Fly on 2026-08-05.** `fly secrets list` confirms zero
  Resend entries.
- **Custom MAIL FROM: `mail.cccdsmiles.com`** — added 2026-08-06, status `SUCCESS`.

## Custom MAIL FROM — why it exists, don't remove it

**Symptom it fixed:** Google's daily DMARC report for cccdsmiles.com showed **`spf` failing on
every message we sent** (7/7 on 2026-08-05), even though the underlying SPF check passed.

**Cause — alignment, not a broken record.** By default SES uses its own bounce domain
(`us-east-2.amazonses.com`) as the envelope sender. SPF then validates *that* domain, which does
not match the visible From address (`cccdsmiles.com`), so **DMARC scores SPF as a fail**. Nothing
was misconfigured; DMARC simply requires the two domains to share a parent. DKIM was aligned and
passing throughout, which is the only reason mail still delivered — the domain was passing DMARC
on one leg instead of two.

**The fix (both halves are required):**
1. SES: `aws sesv2 put-email-identity-mail-from-attributes --email-identity cccdsmiles.com --mail-from-domain mail.cccdsmiles.com --behavior-on-mx-failure USE_DEFAULT_VALUE --region us-east-2`
2. Cloudflare DNS on `mail.cccdsmiles.com` — **MX** `feedback-smtp.us-east-2.amazonses.com`
   priority 10, and **TXT** `v=spf1 include:amazonses.com ~all`.

**Verified at the source** — headers of a live test message delivered 2026-08-06:
`spf=pass smtp.mailfrom=…@mail.cccdsmiles.com` · `dkim=pass header.i=@cccdsmiles.com` ·
**`dmarc=pass header.from=cccdsmiles.com`**. Both legs now align.

⚠️ **Deleting either DNS record silently reverts this.** SES falls back to its own domain
(`USE_DEFAULT_VALUE` means mail keeps flowing rather than bouncing), so nothing breaks loudly —
SPF alignment just starts failing again in the DMARC reports. The MX record is for bounce
handling only; it does **not** affect inbound mail to cccdsmiles.com.

**Note:** `destinationsmile.com` sends via Google Workspace, not SES, so it does not need this.
Its DMARC policy is a separate matter — both domains are still at `p=none` (monitor only).

## ⚠️ SES is still in the sandbox — know what that means

As of 2026-08-05: `ProductionAccessEnabled: false`, quota 200/day, support case
`178579830500567` still open.

**In sandbox, SES delivers only to verified identities.** Verifying an address does **not**
release the sandbox — the two are unrelated. Verified so far:

| Identity | Status |
|---|---|
| `cccdsmiles.com` (domain, DKIM) | ✅ SUCCESS |
| `pjbroome@gmail.com` | ✅ SUCCESS |
| `drbroome@destinationsmile.com` | ⏳ PENDING — needs one click |
| `info@destinationsmile.com` | ⏳ PENDING — needs one click |

**Until production access is granted, the platform cannot email an arbitrary patient.** The
approved workaround is that staff send the consultation link by hand from
`info@destinationsmile.com` (Google Workspace, BAA-covered). That path needs no SES approval.

## If email breaks, check these first — do NOT reach for Resend

1. Is the recipient a **verified SES identity**? While sandboxed, an unverified recipient fails
   with `MessageRejected — Email address is not verified`. That is expected behaviour.
2. Are the AWS credentials present on the app (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `AWS_DEFAULT_REGION=us-east-2`)?
3. Is `EMAIL_FROM` a verified identity?
4. Has production access been granted? `aws sesv2 get-account --region us-east-2`

Adding a non-BAA provider to make a test pass would trade a HIPAA obligation for convenience.
Don't.
