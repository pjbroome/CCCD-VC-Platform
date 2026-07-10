# VC Platform — HIPAA / BAA + Storage Plan (Go-Live Gate)

_Owner: Dr. Patrick Broome (CCCD / Destination Smile). Drafted 2026-06-22. **This is a go-live prerequisite** — the platform may keep being built/tested, but does NOT go live for real patients until the BAAs below are signed and the safeguards are verified._

The VC platform is the patient-acquisition machine (all inbound callers are funneled to it for pricing/info), so it collects **real PHI**. Two layers are required: the **legal layer (BAAs)** and the **technical layer (safeguards)**. A BAA alone does **not** make the app compliant.

---

## 1. PHI data inventory — what we collect & where it lives today

| Data | Contains | Stored | Sensitivity |
|---|---|---|---|
| Patient intake records | name, email, phone, DOB, concern/message | JSON file on **Fly volume** (`/data/vc/vc_requests.json`) | PHI |
| Patient photos | smile/face photos | **Fly volume** (`/data/vc/patient_photos/`) | PHI (high) |
| Consult **video replies** | Dr. Broome's personalized video | **Fly volume** (`/data/vc/consult_videos/`) | PHI |
| Patient notify email | first name + tokenized link (PHI-minimal by design) | sent via **Resend** | PHI-minimal |

Real records already present (4 as of 2026-06-22), so this is live PHI, not hypothetical.

## 2. BAAs to sign (the legal layer) — **Patrick's action**

| Vendor | Why | How to request | Status |
|---|---|---|---|
| **Fly.io** | hosts app + the volume holding records/photos/videos | **[fly.io/dashboard/personal/compliance](https://fly.io/dashboard/personal/compliance)** — pre-signed by Fly, activates when Patrick countersigns | ☐ TODO |
| **Resend** | sends patient-identifiable emails | Confirm Resend offers a BAA (HIPAA tier); if not, either switch to a BAA-capable sender (e.g. AWS SES, Paubox) **or** strip the email to fully non-PHI (generic "your reply is ready" + tokenized link, no name) | ☐ TODO / verify |
| **AWS** | only if videos move to S3 (see §3) | self-serve BAA via **AWS Artifact** once an AWS account exists | ☐ conditional |

> Claude cannot sign BAAs (legal agreement, account-owner identity required). These are Patrick's to execute.

## 3. Storage plan (the architecture)

**Records + photos (small):** keep on the **Fly volume** for now — Fly volumes are **encrypted at rest**, and the Fly BAA covers them. Optional later upgrade: records → Supabase Postgres (BAA on Pro+) for queryability/audit.

**Video replies (bulky, archivable) — recommended: AWS S3 + lifecycle tiering** (matches Patrick's spec: hot 30 days → archive, retrieval-on-request OK, low cost):
- New videos → **S3 Standard** (instant rewatch).
- **Lifecycle rule:** after **30 days** → **S3 Glacier Deep Archive** (retrieval-on-request; pennies).
- **Cost (≈1,000 consults / 50 GB):** ~$1.15/mo hot, ~$0.05/mo archived. Negligible.
- The backend already has an "S3/GCS upgrade" hook in `main.py`, so wiring is clean.
- **Encryption:** S3 SSE (SSE-S3 or SSE-KMS) on; TLS in transit.

**Fallback (no AWS):** keep videos on the Fly volume (Fly BAA covers it) — simpler, but ~$0.15/GB/mo (≈$7.50/mo for 50 GB) and **no auto-archive tier**. Acceptable short-term; S3 is better for the cost + archive model Patrick described.

> ⚠️ **Tool flag:** S3 = a new AWS account + BAA (~$1–2/mo). Decision pending from Patrick (S3 vs stay-on-Fly).

## 4. Technical safeguards (what the BAA does NOT cover — Claude's build work)

| Safeguard | Status / plan |
|---|---|
| **Encryption in transit** | ✅ `force_https` on (Fly), TLS everywhere |
| **Encryption at rest** | ✅ Fly volume encrypted; S3 SSE when added |
| **Access control** | ✅ admin bearer-token auth (`VC_ADMIN_PASSWORD`); **TODO:** per-staff accounts + rotate shared password; consider 2FA |
| **Audit logging** | ⬜ **BUILD:** log PHI access (who viewed/downloaded which patient record/photo/video, when). Currently minimal — this is the next safeguard to implement |
| **Data minimization** | ✅ patient email is PHI-minimal (first name + token) |
| **Retention & disposal** | ⬜ define policy: videos hot 30d → archive; records retained per policy; secure deletion path (`/vc/maintenance/cleanup` exists — formalize) |
| **Backups** | ⬜ Fly volume snapshots + (if S3) versioning |
| **Breach-notification process** | ⬜ document the process (Patrick + office) |
| **Session security** | ✅ tokens expire; ⚠️ in-memory sessions reset on deploy (acceptable) |

## 5. Go-live checklist (all must be ✅ before real-patient launch)
- [ ] Fly BAA signed
- [ ] Resend BAA signed **or** emails confirmed non-PHI
- [ ] (if S3) AWS BAA signed + bucket encrypted + lifecycle rule set
- [ ] Audit logging for PHI access implemented
- [ ] Retention/disposal policy documented + enforced
- [ ] Shared admin password rotated; access list reviewed
- [ ] Breach-notification process documented
- [ ] Final security re-test (the matrix already passes today)

---
_Build continues in parallel; this gate is checked at launch, not before development._
