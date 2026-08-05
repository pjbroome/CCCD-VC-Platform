# Patient media archive — S3 + Glacier Instant Retrieval

**Built 2026-08-05. Verified working end to end.**

## What it does

Every night at 02:30 local, patient videos and photos are copied from the Fly volume to a
private, encrypted, versioned S3 bucket. After 90 days each object moves automatically to
**Glacier Instant Retrieval**. Nothing is ever deleted, from either side.

| | |
|---|---|
| Bucket | `cccd-vc-media-archive-133381932958` (us-east-1) |
| Public access | **fully blocked** — all four settings |
| Encryption at rest | AES-256, bucket-key enabled |
| Versioning | **on** — an overwrite or delete never loses a video |
| Lifecycle | `videos/` and `photos/` → **GLACIER_IR at day 90**; old versions → GIR at day 30 |
| Job | launchd `com.cccd.vc-media-backup`, 02:30 daily |
| Script | `scripts/vc-media-backup.sh` · log `~/.cache/vc-media-backup.log` |

## Why Glacier *Instant* Retrieval, not the cheaper tiers

The requirement was **staff can pull any video at any time**. That single sentence rules out
the cheaper archive classes:

| Class | Cost/GB/mo | Retrieval time | Verdict |
|---|---|---|---|
| S3 Standard | $0.023 | instant | Fine, but 6× the cost for cold data |
| **Glacier Instant Retrieval** | **$0.004** | **milliseconds** | ✅ **chosen** |
| Glacier Flexible | $0.0036 | 1 min – 5 hours | ❌ staff would wait |
| Deep Archive | $0.00099 | up to 12 hours | ❌ unusable for a consult review |

GIR costs ~83% less than Standard while opening a three-year-old video as fast as yesterday's.
**90 days is also GIR's minimum billable duration** — transitioning sooner would cost *more*,
not less, because you'd pay an early-deletion charge. So 90 days is both the practical and the
economically correct threshold.

## Cost at your actual volume

15 consults/day, ~10 MB video + ~3 MB photos each ≈ **195 MB/day ≈ 70 GB/year**.

- Year 1, all-in: **under $1.00/month**
- After 10 years (~700 GB, nearly all in GIR): **~$2.78/month**

Storage is effectively free at this scale. The reason to care is durability, not cost.

## Restoring a video

No restore job, no waiting — GIR is a direct read:

```bash
aws s3 cp s3://cccd-vc-media-archive-133381932958/videos/<filename>.mp4 ./restored.mp4
```

Verified 2026-08-05: a video pulled back from S3 was byte-intact and ffprobe-confirmed as
valid H.264/AAC.

## What this protects against — and what it doesn't

**Protects against:** the Fly volume being lost, a region failure, an accidental mass delete
noticed after Fly's 5-day snapshot window has passed, and simply needing a video from years
ago after it has aged off primary storage.

**Does not replace** Fly's daily volume snapshots (5-day retention), which remain the fast
path for "undo the last bad thing." The two are complementary: snapshots are for *recent*
mistakes, this archive is for *durability*.

## ⚠️ Two traps found while building this — do not relearn

1. **`flyctl` installs to `~/.fly/bin`**, which is NOT on a launchd job's default PATH. Omitting
   it made the script report "nothing to back up" while three videos sat on the volume.
2. **`FLY_API_TOKEN` in `~/.config/cccd/secrets.env` is STALE.** Sourcing the secrets store
   overrides flyctl's working session in `~/.fly/config.yml` and makes every command fail with
   *"You must be authenticated to view this."* The script now `unset`s it after sourcing.
   **Any other script that sources the secrets store and then calls `fly` will hit this.**

Both failures were silent — the script exited 0 and logged a cheerful "nothing to back up."
That is the dangerous shape of a broken backup, which is why the log now prints counts
("3 on volume, 3 newly archived") rather than just success.
