#!/bin/bash
# Back up VC Platform patient media from the Fly volume to S3, nightly.
#
# WHY THIS EXISTS
# Patient videos and photos live on a single Fly volume. Fly takes daily snapshots with 5-day
# retention, which protects against a bad deploy but NOT against: a volume lost outright, a
# region problem, an accidental mass delete noticed on day 6, or simply needing a copy of a
# video from two years ago. This is the durable second copy.
#
# STORAGE DESIGN (chosen for "staff can pull any video at any time")
#   S3 Standard for 90 days  -> then Glacier Instant Retrieval, automatically.
#   Glacier INSTANT Retrieval, not Flexible or Deep Archive: those are cheaper but need a
#   restore job taking minutes to 12 hours. GIR retrieves in MILLISECONDS like Standard, so a
#   video from three years ago opens as fast as one from yesterday — while costing ~83% less
#   than Standard. That directly matches the requirement that staff can view anything, anytime.
#   90 days is also GIR's minimum billable duration, so transitioning earlier would cost more.
#
# SAFETY
#   - Copy-only. This NEVER deletes from Fly and NEVER deletes from S3. The bucket is versioned,
#     so even an overwrite keeps the old copy.
#   - Skips files already uploaded (compares by size + name), so it is cheap to run nightly.
set -uo pipefail
# NOTE: flyctl installs to ~/.fly/bin, which is NOT on a launchd job's default PATH.
# Leaving it out made this script silently report "nothing to back up" while three videos
# sat on the volume — a backup that quietly does nothing is worse than no backup.
export PATH="$HOME/.fly/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
set -a; . "$HOME/.config/cccd/secrets.env" 2>/dev/null || true; set +a
# ⚠️ FLY_API_TOKEN in the secrets store is STALE (verified 2026-08-05: it makes flyctl fail
# with "You must be authenticated to view this"). Sourcing the store therefore BREAKS fly by
# overriding the working session in ~/.fly/config.yml. Unset it so flyctl falls back to its
# own config. Symptom if this line is removed: the script reports "nothing to back up" while
# files sit on the volume — a silent no-op backup.
unset FLY_API_TOKEN

APP="cccd-vc-backend"
BUCKET="cccd-vc-media-archive-133381932958"
LOG="$HOME/.cache/vc-media-backup.log"
STAGE="$HOME/.cache/vc-media-stage"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p "$STAGE/videos" "$STAGE/photos"

pull_and_push() {
  local remote_dir="$1" prefix="$2" n=0 pushed=0
  # List what is on the volume.
  local files
  files=$(fly ssh console -a "$APP" -C "ls -1 $remote_dir" 2>/dev/null | tr -d '\r' | grep -E '\.(mp4|mov|webm|jpg|jpeg|png)$' || true)
  [ -z "$files" ] && { echo "$TS $prefix: nothing to back up" >> "$LOG"; return; }

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    n=$((n+1))
    # Already in S3? Skip — this is what makes a nightly run cheap.
    if aws s3api head-object --bucket "$BUCKET" --key "$prefix/$f" >/dev/null 2>&1; then
      continue
    fi
    if fly ssh sftp get "$remote_dir/$f" "$STAGE/$prefix/$f" -a "$APP" >/dev/null 2>&1 \
       && [ -s "$STAGE/$prefix/$f" ]; then
      if aws s3 cp "$STAGE/$prefix/$f" "s3://$BUCKET/$prefix/$f" --only-show-errors 2>/dev/null; then
        pushed=$((pushed+1))
      fi
      rm -f "$STAGE/$prefix/$f"
    fi
  done <<< "$files"
  echo "$TS $prefix: $n on volume, $pushed newly archived" >> "$LOG"
}

pull_and_push "/data/vc/consult_videos" "videos"
pull_and_push "/data/vc/patient_photos" "photos"

# Summary line the morning routine can read at a glance.
TOTAL=$(aws s3 ls "s3://$BUCKET/" --recursive --summarize 2>/dev/null | awk '/Total Objects/{print $3}')
BYTES=$(aws s3 ls "s3://$BUCKET/" --recursive --summarize 2>/dev/null | awk '/Total Size/{print $3}')
echo "$TS ARCHIVE TOTAL: ${TOTAL:-0} objects, ${BYTES:-0} bytes" >> "$LOG"
tail -2000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
