"""Patient photo normalization: EXIF authenticity extraction, GPS strip, safe storage.

Philosophy (Patrick, 2026-08-02): flag suspicious metadata for staff review — never reject uploads.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import struct
from pathlib import Path
from typing import Any, Optional


def _read_u16(data: bytes, offset: int, little: bool) -> int:
    fmt = "<H" if little else ">H"
    return struct.unpack_from(fmt, data, offset)[0]


def _read_u32(data: bytes, offset: int, little: bool) -> int:
    fmt = "<I" if little else ">I"
    return struct.unpack_from(fmt, data, offset)[0]


def _read_rational(data: bytes, offset: int, little: bool) -> float:
    num = _read_u32(data, offset, little)
    den = _read_u32(data, offset + 4, little)
    return num / den if den else 0.0


def _parse_exif_tiff(exif_payload: bytes) -> dict[str, Any]:
    """Parse EXIF TIFF payload (after 'Exif\\0\\0') into tag → value."""
    if len(exif_payload) < 8:
        return {}
    endian = exif_payload[0:2]
    little = endian == b"II"
    if endian not in (b"II", b"MM"):
        return {}
    if _read_u16(exif_payload, 2, little) != 0x002A:
        return {}
    ifd0_offset = _read_u32(exif_payload, 4, little)
    return _parse_ifd(exif_payload, ifd0_offset, little)


def _parse_ifd(data: bytes, offset: int, little: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if offset + 2 > len(data):
        return out
    count = _read_u16(data, offset, little)
    pos = offset + 2
    for _ in range(count):
        if pos + 12 > len(data):
            break
        tag = _read_u16(data, pos, little)
        typ = _read_u16(data, pos + 2, little)
        count_val = _read_u32(data, pos + 4, little)
        val_off = pos + 8
        entry_size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}.get(typ, 1) * count_val
        if entry_size > 4:
            data_off = _read_u32(data, val_off, little)
            raw = data[data_off : data_off + entry_size]
        else:
            raw = data[val_off : val_off + entry_size]

        if tag == 0x010F:  # Make
            out["make"] = raw.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif tag == 0x0110:  # Model
            out["model"] = raw.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif tag == 0x0131:  # Software
            out["software"] = raw.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif tag == 0x0132:  # DateTime
            out["datetime"] = raw.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif tag == 0x9003:  # DateTimeOriginal
            out["datetime_original"] = raw.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif tag == 0x8825:  # GPS IFD pointer
            gps_off = _read_u32(data, val_off, little)
            gps = _parse_gps_ifd(data, gps_off, little)
            if gps:
                out["gps"] = gps
        elif tag == 0x8769:  # Exif sub-IFD
            sub_off = _read_u32(data, val_off, little)
            sub = _parse_ifd(data, sub_off, little)
            out.update({k: v for k, v in sub.items() if k not in out})
        pos += 12
    return out


def _parse_gps_ifd(data: bytes, offset: int, little: bool) -> Optional[dict[str, float]]:
    if offset + 2 > len(data):
        return None
    count = _read_u16(data, offset, little)
    lat_ref = lon_ref = None
    lat = lon = None
    pos = offset + 2
    for _ in range(count):
        if pos + 12 > len(data):
            break
        tag = _read_u16(data, pos, little)
        typ = _read_u16(data, pos + 2, little)
        count_val = _read_u32(data, pos + 4, little)
        val_off = pos + 8
        entry_size = {1: 1, 2: 1, 3: 2, 5: 8}.get(typ, 1) * count_val
        if entry_size > 4:
            data_off = _read_u32(data, val_off, little)
            raw = data[data_off : data_off + entry_size]
        else:
            raw = data[val_off : val_off + entry_size]

        if tag == 1 and raw:
            lat_ref = raw[:1].decode("ascii", errors="replace")
        elif tag == 3 and raw:
            lon_ref = raw[:1].decode("ascii", errors="replace")
        elif tag == 2 and typ == 5 and len(raw) >= 24:
            lat = _dms_to_decimal(raw, little)
        elif tag == 4 and typ == 5 and len(raw) >= 24:
            lon = _dms_to_decimal(raw, little)
        pos += 12
    if lat is None or lon is None:
        return None
    if lat_ref == "S":
        lat = -lat
    if lon_ref == "W":
        lon = -lon
    return {"lat": lat, "lon": lon}


def _dms_to_decimal(raw: bytes, little: bool) -> float:
    d = _read_rational(raw, 0, little)
    m = _read_rational(raw, 8, little)
    s = _read_rational(raw, 16, little)
    return d + m / 60.0 + s / 3600.0


def extract_jpeg_exif(data: bytes) -> dict[str, Any]:
    """Extract EXIF dict from JPEG bytes (empty if none)."""
    if not data.startswith(b"\xff\xd8"):
        return {}
    i = 2
    while i + 4 < len(data):
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker in (0xD8, 0xD9):
            break
        if marker == 0xDA:  # SOS — image data starts
            break
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        seg_start = i + 4
        seg_end = seg_start + seg_len - 2
        if marker == 0xE1 and seg_end <= len(data):
            payload = data[seg_start:seg_end]
            if payload.startswith(b"Exif\x00\x00"):
                return _parse_exif_tiff(payload[6:])
            break
        i = seg_end
    return {}


def strip_jpeg_exif(data: bytes) -> bytes:
    """Remove APP1 (EXIF) and other metadata segments; keep image scan data intact."""
    if not data.startswith(b"\xff\xd8"):
        return data
    out = bytearray(data[0:2])
    i = 2
    while i + 4 < len(data):
        if data[i] != 0xFF:
            out.extend(data[i:])
            break
        marker = data[i + 1]
        if marker in (0xD8,):
            i += 2
            continue
        if marker == 0xD9:
            out.extend(data[i:])
            break
        if marker == 0xDA:
            out.extend(data[i:])
            break
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        seg_end = i + 2 + seg_len
        # Drop APP segments (EXIF, ICC, XMP, etc.) — 0xE0–0xEF
        if not (0xE0 <= marker <= 0xEF):
            out.extend(data[i:seg_end])
        i = seg_end
    return bytes(out)


def _parse_exif_datetime(value: Optional[str]) -> Optional[dt.datetime]:
    if not value:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def build_authenticity_verdict(
    exif: dict[str, Any],
    *,
    submitted_at: Optional[dt.datetime] = None,
    claimed_zip: Optional[str] = None,
) -> dict[str, Any]:
    """Staff-facing authenticity summary. Never blocks intake."""
    submitted_at = submitted_at or dt.datetime.now(dt.timezone.utc)
    flags: list[str] = []
    signals: dict[str, Any] = {}

    if exif.get("make"):
        signals["camera_make"] = exif["make"]
    if exif.get("model"):
        signals["camera_model"] = exif["model"]
    if exif.get("software"):
        signals["software"] = exif["software"]
        sw = exif["software"].lower()
        if any(x in sw for x in ("photoshop", "snapseed", "lightroom", "instagram", "facetune")):
            flags.append(f"Edited with {exif['software']}")

    capture_raw = exif.get("datetime_original") or exif.get("datetime")
    capture_dt = _parse_exif_datetime(capture_raw)
    if capture_dt:
        signals["capture_time"] = capture_dt.isoformat()
        # Treat naive EXIF timestamps as local-ish; compare in UTC for staleness only.
        capture_utc = capture_dt.replace(tzinfo=dt.timezone.utc)
        age_days = (submitted_at - capture_utc).days
        signals["capture_age_days"] = age_days
        if age_days > 30:
            flags.append(f"Photo taken {age_days} days before submission")
        elif age_days < -1:
            flags.append("Capture timestamp is in the future")
    elif exif:
        flags.append("No capture date in EXIF (common on browser uploads)")

    if exif.get("gps"):
        # GPS is extracted for verdict only — never stored after strip.
        flags.append("GPS was present in original upload (stripped from stored file)")

    verdict = "neutral"
    if flags:
        verdict = "review" if any("days before" in f or "Edited" in f for f in flags) else "noted"

    return {
        "verdict": verdict,
        "flags": flags,
        "signals": signals,
    }


def process_patient_photo(content: bytes, ext: str) -> tuple[bytes, dict[str, Any]]:
    """Return (bytes_to_store, metadata_dict). Strips GPS/EXIF from stored JPEGs."""
    meta: dict[str, Any] = {"format": ext.lstrip(".")}
    if ext.lower() in (".jpg", ".jpeg") and content.startswith(b"\xff\xd8"):
        exif = extract_jpeg_exif(content)
        meta["authenticity"] = build_authenticity_verdict(exif)
        stored = strip_jpeg_exif(content)
        meta["exif_stripped"] = len(stored) != len(content)
        meta["stored_bytes"] = len(stored)
        return stored, meta
    # PNG/GIF/WebP/HEIC — pass through; no GPS strip path without re-encode
    meta["authenticity"] = build_authenticity_verdict({})
    meta["exif_stripped"] = False
    meta["stored_bytes"] = len(content)
    return content, meta


def save_photo_metadata(photos_dir: Path, filename: str, meta: dict[str, Any]) -> None:
    sidecar = photos_dir / f"{Path(filename).stem}.meta.json"
    sidecar.write_text(json.dumps(meta, indent=2))


def load_photo_metadata(photos_dir: Path, photo_ref: str) -> Optional[dict[str, Any]]:
    """Load sidecar for a photo path or bare filename."""
    name = Path(photo_ref).name
    sidecar = photos_dir / f"{Path(name).stem}.meta.json"
    if not sidecar.is_file():
        return None
    try:
        return json.loads(sidecar.read_text())
    except Exception:
        return None


def aggregate_request_photo_authenticity(
    photos_dir: Path, photo_refs: list[str]
) -> list[dict[str, Any]]:
    """Combine per-photo authenticity for staff display on the request."""
    out: list[dict[str, Any]] = []
    for ref in photo_refs:
        meta = load_photo_metadata(photos_dir, ref)
        if not meta:
            out.append({"photo": Path(ref).name, "verdict": "unknown", "flags": []})
            continue
        auth = meta.get("authenticity") or {}
        out.append(
            {
                "photo": Path(ref).name,
                "verdict": auth.get("verdict", "neutral"),
                "flags": auth.get("flags", []),
                "signals": auth.get("signals", {}),
            }
        )
    return out
