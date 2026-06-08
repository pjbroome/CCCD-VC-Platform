"""Regression tests: path-traversal protection on the media-serving endpoints.

Covers the _safe_media_path guard used by /vc/photos/{filename} and
/vc/videos/{filename}. Runs under pytest, or standalone:  python tests/test_media_path_traversal.py
"""
import os
import sys

os.environ.setdefault("RAG_ENABLED", "false")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException  # noqa: E402
from app.main import _safe_media_path, _PHOTOS_DIR, _VIDEOS_DIR  # noqa: E402

VALID = "4b793e120c404ebb804fde6574df039b.png"
TRAVERSALS = [
    "../../etc/passwd",
    "../secret",
    "..",
    "/etc/passwd",
    "a/b.png",
    "x\\y",
    "..%2f..%2fetc/passwd",
    "....//etc",
    "",
]


def test_valid_filename_stays_in_base():
    for base in (_PHOTOS_DIR, _VIDEOS_DIR):
        resolved = _safe_media_path(base, VALID)
        assert str(resolved).startswith(str(base.resolve()))


def test_traversal_is_blocked():
    for base in (_PHOTOS_DIR, _VIDEOS_DIR):
        for bad in TRAVERSALS:
            try:
                _safe_media_path(base, bad)
            except HTTPException as exc:
                assert exc.status_code == 404
            else:
                raise AssertionError(f"path traversal NOT blocked: {bad!r}")


if __name__ == "__main__":
    test_valid_filename_stays_in_base()
    test_traversal_is_blocked()
    print("path-traversal tests passed")
