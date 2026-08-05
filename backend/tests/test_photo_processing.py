"""Tests for patient photo EXIF extraction and stripping."""
import datetime as dt

from app.photo_processing import (
    build_authenticity_verdict,
    extract_jpeg_exif,
    process_patient_photo,
    strip_jpeg_exif,
)


def test_strip_jpeg_removes_app1():
    # Minimal JPEG with fake APP1 segment
    jpeg = b"\xff\xd8\xff\xe1\x00\x10Exif\x00\x00II*\x00\x08\x00\x00\x00\xff\xd9"
    stripped = strip_jpeg_exif(jpeg)
    assert b"Exif" not in stripped
    assert stripped.startswith(b"\xff\xd8")


def test_build_authenticity_staleness_flag():
    old = dt.datetime(2024, 1, 1, 12, 0, 0)
    exif = {"datetime_original": old.strftime("%Y:%m:%d %H:%M:%S")}
    submitted = dt.datetime(2025, 6, 1, tzinfo=dt.timezone.utc)
    verdict = build_authenticity_verdict(exif, submitted_at=submitted)
    assert verdict["verdict"] == "review"
    assert any("days before" in f for f in verdict["flags"])


def test_process_patient_photo_jpeg_roundtrip():
    # Tiny valid-ish JPEG header only — process should not crash
    content = b"\xff\xd8\xff\xd9"
    stored, meta = process_patient_photo(content, ".jpg")
    assert stored.startswith(b"\xff\xd8")
    assert "authenticity" in meta
