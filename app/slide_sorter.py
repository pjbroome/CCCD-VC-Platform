"""VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.

The VC agent calls these functions to pull the right before/after slides
for each guest based on their concerns, desired treatments, and context.
"""
import json
import os
import secrets
import datetime
from typing import Optional
from pathlib import Path

# The slide catalog + images live on a persistent volume (/data/vc) when one
# is mounted, so deletes and uploads survive Fly deploys. We seed the volume
# from the baked-in app files on first boot. If anything about the volume is
# off, we fall back to the app directory (current behaviour) so the library
# never breaks.
_APP_VC_DIR = Path(__file__).parent / "vc_slides"


def _resolve_vc_dir() -> tuple[Path, Path]:
    """Return (catalog_dir, images_dir), preferring a mounted /data volume."""
    if Path("/data").exists():
        try:
            import shutil
            vol = Path("/data/vc")
            vol.mkdir(parents=True, exist_ok=True)
            vimg = vol / "slide_images"
            vimg.mkdir(parents=True, exist_ok=True)
            app_img = _APP_VC_DIR / "slide_images"
            if app_img.exists():
                for f in app_img.iterdir():
                    if f.is_file() and not (vimg / f.name).exists():
                        shutil.copy2(f, vimg / f.name)
            vcat = vol / "indexed_catalog.json"
            app_cat = _APP_VC_DIR / "indexed_catalog.json"
            if not vcat.exists() and app_cat.exists():
                shutil.copy2(app_cat, vcat)
            # Only use the volume if it actually has images seeded.
            if any(vimg.iterdir()):
                return vol, vimg
        except Exception:
            pass
    return _APP_VC_DIR, (_APP_VC_DIR / "slide_images")


_VC_DIR, _IMAGES_DIR = _resolve_vc_dir()
_CATALOG_PATH = _VC_DIR / "indexed_catalog.json"
_catalog: list[dict] = []


def _load_catalog():
    """Load the indexed slide catalog from disk."""
    global _catalog
    if _catalog:
        return
    if _CATALOG_PATH.exists():
        with open(_CATALOG_PATH) as f:
            _catalog = json.load(f)
    else:
        _catalog = []


def get_catalog_stats() -> dict:
    """Return high-level stats about the slide catalog."""
    _load_catalog()

    treat_counts: dict[str, int] = {}
    concern_counts: dict[str, int] = {}
    cost_values: list[float] = []

    for s in _catalog:
        for t in s.get("treatments", []):
            treat_counts[t] = treat_counts.get(t, 0) + 1
        for c in s.get("concerns", []):
            concern_counts[c] = concern_counts.get(c, 0) + 1
        if s.get("cost_numeric"):
            cost_values.append(s["cost_numeric"])

    return {
        "total_slides": len(_catalog),
        "total_images": sum(s.get("image_count", 0) for s in _catalog),
        "slides_with_pricing": len(cost_values),
        "cost_range": {
            "min": min(cost_values) if cost_values else 0,
            "max": max(cost_values) if cost_values else 0,
            "avg": round(sum(cost_values) / len(cost_values), 0) if cost_values else 0,
        },
        "treatment_types": dict(sorted(treat_counts.items(), key=lambda x: -x[1])),
        "concern_types": dict(sorted(concern_counts.items(), key=lambda x: -x[1])),
        "celebrity_cases": sum(1 for s in _catalog if s.get("is_celebrity_case")),
    }


def search_slides(
    treatments: Optional[list[str]] = None,
    concerns: Optional[list[str]] = None,
    min_complexity: Optional[int] = None,
    max_complexity: Optional[int] = None,
    max_cost: Optional[float] = None,
    min_cost: Optional[float] = None,
    gender: Optional[str] = None,
    celebrity_only: bool = False,
    slide_type: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """Search slides by treatment type, concern, complexity, cost, etc.

    Args:
        treatments: Filter by treatment types (e.g. ["no_prep_veneers", "invisalign"])
        concerns: Filter by patient concerns (e.g. ["discoloration", "confidence"])
        min_complexity: Minimum complexity score (1-10)
        max_complexity: Maximum complexity score (1-10)
        max_cost: Maximum cost in dollars
        min_cost: Minimum cost in dollars
        gender: Filter by patient gender ("male", "female")
        celebrity_only: Only return celebrity/ambassador cases
        slide_type: Filter by slide type ("before_after_case", "before_after_pair", etc.)
        limit: Max results to return (default 10)

    Returns:
        List of matching slides with metadata and image paths.
    """
    _load_catalog()

    results = []
    for slide in _catalog:
        # Treatment filter
        if treatments:
            slide_treatments = slide.get("treatments", [])
            if not any(t in slide_treatments for t in treatments):
                continue

        # Concern filter
        if concerns:
            slide_concerns = slide.get("concerns", [])
            if not any(c in slide_concerns for c in concerns):
                continue

        # Complexity filter
        complexity = slide.get("complexity")
        if min_complexity is not None and (complexity is None or complexity < min_complexity):
            continue
        if max_complexity is not None and (complexity is None or complexity > max_complexity):
            continue

        # Cost filter
        cost = slide.get("cost_numeric")
        if max_cost is not None and (cost is None or cost > max_cost):
            continue
        if min_cost is not None and (cost is None or cost < min_cost):
            continue

        # Gender filter
        if gender and slide.get("gender") != gender:
            continue

        # Celebrity filter
        if celebrity_only and not slide.get("is_celebrity_case"):
            continue

        # Slide type filter
        if slide_type and slide.get("slide_type") != slide_type:
            continue

        # Build result entry (exclude raw notes for API response size)
        result = {
            "slide_number": slide["slide_number"],
            "condition": slide.get("condition", ""),
            "solution": slide.get("solution", ""),
            "complexity": slide.get("complexity"),
            "tone": slide.get("tone", []),
            "duration": slide.get("duration", ""),
            "cost_bracket": slide.get("cost_bracket", ""),
            "cost_numeric": slide.get("cost_numeric"),
            "treatments": slide.get("treatments", []),
            "concerns": slide.get("concerns", []),
            "gender": slide.get("gender", "unknown"),
            "is_celebrity_case": slide.get("is_celebrity_case", False),
            "slide_type": slide.get("slide_type", ""),
            "image_count": slide.get("image_count", 0),
            "images": slide.get("images", []),
            "text_content": slide.get("text_content", []),
        }
        results.append(result)

        if len(results) >= limit:
            break

    return results


def get_slide_detail(slide_number: int) -> Optional[dict]:
    """Get full details for a specific slide including raw notes."""
    _load_catalog()

    for slide in _catalog:
        if slide["slide_number"] == slide_number:
            return slide
    return None


def match_guest_to_slides(
    guest_description: str,
    limit: int = 5,
) -> list[dict]:
    """Smart matching — given a guest's description of their concerns,
    find the most relevant slides to show them.

    This uses keyword matching against the catalog's indexed fields.
    """
    _load_catalog()

    desc_lower = guest_description.lower()

    # Map guest language to treatment types
    treatment_keywords = {
        "no_prep_veneers": ["no prep", "no-prep", "veneer", "veneers", "porcelain"],
        "invisalign": ["invisalign", "straighten", "crooked", "alignment", "braces"],
        "gum_lift": ["gummy", "gum", "gums"],
        "full_mouth_rejuvenation": ["full mouth", "everything", "all teeth", "complete", "rejuvenation"],
        "implants": ["implant", "missing tooth", "missing teeth", "denture", "bridge"],
        "whitening": ["whiten", "whitening", "bright", "brighter", "yellow"],
        "icon": ["white spot", "white spots", "icon"],
        "bonding": ["bonding", "chip", "chipped"],
        "maryland_bridge": ["maryland", "3d print"],
    }

    # Map guest language to concerns
    concern_keywords = {
        "discoloration": ["stain", "discolor", "dark", "yellow", "gray", "grey", "color"],
        "worn_teeth": ["worn", "wear", "broken", "break", "chip", "crack"],
        "gummy_smile": ["gummy", "too much gum", "gum line", "uneven gum"],
        "small_teeth": ["small teeth", "tiny teeth", "short teeth"],
        "spacing": ["gap", "space", "spacing"],
        "crowding": ["crowd", "overlap", "crooked"],
        "sensitivity": ["sensitive", "pain", "hurt", "painful"],
        "missing_teeth": ["missing", "lost tooth", "lost teeth", "no tooth"],
        "bad_previous_work": ["redo", "fix", "unhappy", "bad work", "another dentist", "elsewhere", "hate my"],
        "confidence": ["confidence", "embarrass", "self-conscious", "afraid to smile", "hide my smile", "insecure"],
        "bite_issues": ["bite", "jaw", "tmj"],
        "acid_erosion": ["acid", "erosion", "erode"],
        "decay": ["decay", "cavity", "cavities", "rot"],
        "trauma": ["accident", "trauma", "injury", "hit", "fell"],
    }

    matched_treatments = []
    for treatment, keywords in treatment_keywords.items():
        if any(kw in desc_lower for kw in keywords):
            matched_treatments.append(treatment)

    matched_concerns = []
    for concern, keywords in concern_keywords.items():
        if any(kw in desc_lower for kw in keywords):
            matched_concerns.append(concern)

    # Score each slide by relevance
    scored_slides = []
    for slide in _catalog:
        score = 0

        # Skip process slides and intro slides
        if slide.get("is_process_slide") or slide["slide_number"] <= 2:
            continue

        # Treatment match
        slide_treatments = slide.get("treatments", [])
        for t in matched_treatments:
            if t in slide_treatments:
                score += 3

        # Concern match
        slide_concerns = slide.get("concerns", [])
        for c in matched_concerns:
            if c in slide_concerns:
                score += 2

        # Bonus for slides with structured data
        if slide.get("condition"):
            score += 0.5
        if slide.get("solution"):
            score += 0.5

        # Bonus for before/after cases (more impactful)
        if slide.get("slide_type") == "before_after_case":
            score += 1

        # Bonus for celebrity cases (social proof)
        if slide.get("is_celebrity_case"):
            score += 0.5

        if score > 0:
            result = {
                "slide_number": slide["slide_number"],
                "relevance_score": score,
                "condition": slide.get("condition", ""),
                "solution": slide.get("solution", ""),
                "complexity": slide.get("complexity"),
                "tone": slide.get("tone", []),
                "duration": slide.get("duration", ""),
                "cost_bracket": slide.get("cost_bracket", ""),
                "cost_numeric": slide.get("cost_numeric"),
                "treatments": slide.get("treatments", []),
                "concerns": slide.get("concerns", []),
                "gender": slide.get("gender", "unknown"),
                "is_celebrity_case": slide.get("is_celebrity_case", False),
                "slide_type": slide.get("slide_type", ""),
                "image_count": slide.get("image_count", 0),
                "images": slide.get("images", []),
                "text_content": slide.get("text_content", []),
            }
            scored_slides.append(result)

    # Sort by relevance score descending
    scored_slides.sort(key=lambda x: -x["relevance_score"])
    return scored_slides[:limit]


def get_slides_for_vc_presentation(
    guest_concerns: list[str],
    guest_treatments: Optional[list[str]] = None,
    include_process: bool = True,
    include_intro: bool = True,
    limit: int = 8,
) -> dict:
    """Build a curated slide deck for a VC presentation.

    Returns intro slides, relevant case slides, and process explanation slides
    in the order they should be presented.
    """
    _load_catalog()

    presentation = {
        "intro_slides": [],
        "case_slides": [],
        "process_slides": [],
        "total_slides": 0,
    }

    # Intro slides (slide 1-2)
    if include_intro:
        for slide in _catalog:
            if slide["slide_number"] <= 2:
                presentation["intro_slides"].append({
                    "slide_number": slide["slide_number"],
                    "images": slide.get("images", []),
                    "text_content": slide.get("text_content", []),
                })

    # Case slides matched to guest
    case_slides = search_slides(
        treatments=guest_treatments,
        concerns=guest_concerns,
        limit=limit,
    )
    presentation["case_slides"] = case_slides

    # Process slides (three-step process)
    if include_process:
        for slide in _catalog:
            if slide.get("is_process_slide"):
                presentation["process_slides"].append({
                    "slide_number": slide["slide_number"],
                    "images": slide.get("images", []),
                    "text_content": slide.get("text_content", []),
                    "notes_raw": slide.get("notes_raw", ""),
                })

    presentation["total_slides"] = (
        len(presentation["intro_slides"])
        + len(presentation["case_slides"])
        + len(presentation["process_slides"])
    )

    return presentation


# --- Management Functions (for Slide Manager UI) ---

def get_all_slides() -> list[dict]:
    """Return all slides with full metadata for the manager UI."""
    _load_catalog()
    return _catalog


def update_slide(slide_number: int, updates: dict) -> Optional[dict]:
    """Update a slide's metadata (condition, solution, treatments, concerns, etc.)."""
    _load_catalog()
    for slide in _catalog:
        if slide["slide_number"] == slide_number:
            for key, value in updates.items():
                if key != "slide_number":
                    slide[key] = value
            _save_catalog()
            return slide
    return None


def reorder_slides(slide_order: list[int]) -> list[dict]:
    """Reorder the catalog based on a list of slide numbers."""
    _load_catalog()
    order_map = {num: idx for idx, num in enumerate(slide_order)}
    _catalog.sort(key=lambda s: order_map.get(s["slide_number"], 9999))
    _save_catalog()
    return _catalog


def _save_catalog():
    """Persist the catalog back to disk."""
    with open(_CATALOG_PATH, "w") as f:
        json.dump(_catalog, f, indent=2)


def delete_slide(slide_number: int) -> bool:
    """Remove a slide from the catalog and best-effort delete its image files."""
    global _catalog
    _load_catalog()
    for i, s in enumerate(_catalog):
        if s["slide_number"] == slide_number:
            removed = _catalog.pop(i)
            _save_catalog()
            for img in removed.get("images", []):
                try:
                    p = _IMAGES_DIR / img
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass
            return True
    return False


def add_slide(filename: str, data: bytes) -> dict:
    """Add a new slide to the library from uploaded image bytes."""
    global _catalog
    _load_catalog()
    import uuid
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    safe = f"upload_{uuid.uuid4().hex}{ext}"
    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    with open(_IMAGES_DIR / safe, "wb") as f:
        f.write(data)
    nums = [s.get("slide_number", 0) for s in _catalog]
    new_num = (max(nums) + 1) if nums else 1
    base = os.path.splitext(os.path.basename(filename or ""))[0]
    title = base[:60] if base else f"Slide {new_num}"
    slide = {
        "slide_number": new_num,
        "condition": title,
        "solution": "",
        "images": [safe],
        "full_slide_image": safe,
        "image_count": 1,
        "text_content": [],
    }
    _catalog.append(slide)
    _save_catalog()
    return slide


# --- Recording Decks ---
# Use persistent volume (/data/) if available, fall back to app directory.
# This ensures data survives Fly.io deploys (container rebuilds).
_DATA_DIR = Path("/data/vc") if Path("/data").exists() else Path(__file__).parent / "vc_slides"
_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_path(filename: str) -> Path:
    """Return path on persistent volume, seeding from app dir if needed."""
    vol_path = _DATA_DIR / filename
    if not vol_path.exists():
        seed = Path(__file__).parent / "vc_slides" / filename
        if seed.exists():
            import shutil
            shutil.copy2(seed, vol_path)
    return vol_path


_DECKS_PATH = _resolve_path("recording_decks.json")
_decks: list[dict] = []


def _load_decks():
    global _decks
    if _DECKS_PATH.exists():
        with open(_DECKS_PATH) as f:
            _decks = json.load(f)
    else:
        _decks = []


def _atomic_write_json(path, data):
    """Write JSON atomically (temp + os.replace) so a crash mid-write can't corrupt PHI."""
    import os as _os
    tmp = f"{path}.tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    _os.replace(tmp, path)


def _save_decks():
    _atomic_write_json(_DECKS_PATH, _decks)


def save_recording_deck(name: str, slide_numbers: list[int]) -> dict:
    """Save a named recording deck (ordered list of slide numbers)."""
    _load_decks()
    import datetime
    deck = {
        "id": max((d["id"] for d in _decks), default=0) + 1,
        "name": name,
        "slide_numbers": slide_numbers,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    _decks.append(deck)
    _save_decks()
    return deck


def get_recording_decks() -> list[dict]:
    """Return all saved recording decks."""
    _load_decks()
    return _decks


def delete_recording_deck(deck_id: int) -> bool:
    """Delete a recording deck by ID."""
    _load_decks()
    for i, deck in enumerate(_decks):
        if deck["id"] == deck_id:
            _decks.pop(i)
            _save_decks()
            return True
    return False


# --- VC Requests (Patient Intake CRM) ---
_REQUESTS_PATH = _resolve_path("vc_requests.json")
_requests: list[dict] = []


def _load_requests():
    global _requests
    if _REQUESTS_PATH.exists():
        with open(_REQUESTS_PATH) as f:
            _requests = json.load(f)
    else:
        _requests = []


def _save_requests():
    _atomic_write_json(_REQUESTS_PATH, _requests)


def create_vc_request(data: dict) -> dict:
    """Create a new VC request from patient intake.
    
    Required fields (Phase 2 schema):
        first_name, last_name, email, phone, concern, consent_acknowledged
    Optional fields:
        date_of_birth, city, state, photos
    Auto-generated:
        id, status (new), notes, deck_id, consultation_id, created_at, updated_at
    """
    import datetime
    _load_requests()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    request = {
        "id": max((r["id"] for r in _requests), default=0) + 1,
        # Patient identity
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "date_of_birth": data.get("date_of_birth"),
        "city": data.get("city"),
        "state": data.get("state"),
        # Attribution
        "referral_source": data.get("referral_source"),
        "source_url": data.get("source_url"),
        # Clinical
        "concern": data.get("concern", ""),
        "consent_acknowledged": data.get("consent_acknowledged", False),
        "photos": data.get("photos", []),
        # Workflow
        "status": "new",  # new → under_review → deck_built → recording_ready → approved → sent
        "notes": "",
        "deck_id": None,
        "consultation_id": None,
        # Timestamps
        "created_at": now,
        "updated_at": now,
        # Legacy compat (kept for seed data migration)
        "patient_name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or data.get("patient_name", ""),
    }
    _requests.append(request)
    _save_requests()
    return request


def get_vc_requests(status: Optional[str] = None) -> list[dict]:
    """Get all VC requests, optionally filtered by status."""
    _load_requests()
    if status:
        return [r for r in _requests if r["status"] == status]
    return _requests


def get_vc_request(request_id: int) -> Optional[dict]:
    """Get a single VC request by ID."""
    _load_requests()
    for r in _requests:
        if r["id"] == request_id:
            return r
    return None


def update_vc_request(request_id: int, updates: dict) -> Optional[dict]:
    """Update a VC request (status, notes, etc.)."""
    import datetime
    _load_requests()
    for r in _requests:
        if r["id"] == request_id:
            for key, value in updates.items():
                if key != "id":
                    r[key] = value
            r["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            _save_requests()
            return r
    return None


def delete_vc_request(request_id: int) -> bool:
    """Delete a VC request."""
    _load_requests()
    for i, r in enumerate(_requests):
        if r["id"] == request_id:
            _requests.pop(i)
            _save_requests()
            return True
    return False


# --- VC Consultations (Archive) ---
_CONSULTATIONS_PATH = _resolve_path("vc_consultations.json")
_consultations: list[dict] = []


def _load_consultations():
    global _consultations
    if _CONSULTATIONS_PATH.exists():
        with open(_CONSULTATIONS_PATH) as f:
            _consultations = json.load(f)
    else:
        _consultations = []


def _save_consultations():
    _atomic_write_json(_CONSULTATIONS_PATH, _consultations)


def create_consultation(data: dict) -> dict:
    """Save a completed consultation to the archive."""
    import datetime
    _load_consultations()
    consultation = {
        "id": max((c["id"] for c in _consultations), default=0) + 1,
        "token": secrets.token_urlsafe(24),
        "token_expires_at": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=60)).isoformat(),
        "request_id": data.get("request_id"),
        "patient_name": data.get("patient_name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "concerns": data.get("concerns", []),
        "photos": data.get("photos", []),
        "slide_numbers": data.get("slide_numbers", []),
        "presentation_name": data.get("presentation_name", ""),
        "script": data.get("script", ""),
        "script_status": data.get("script_status", "draft"),  # draft, approved, rejected
        "video_url": data.get("video_url", ""),
        "clone_video_url": data.get("clone_video_url", ""),  # AI Clone generated video
        "video_source": data.get("video_source", "doctor"),  # doctor, clone
        "summary_slide_data": data.get("summary_slide_data"),
        "training_video_ids": data.get("training_video_ids", []),  # Smile Virtual videos clone learned from
        "status": "sent",  # draft, script_ready, recording, sent, watched, follow_up_sent
        "watch_count": 0,
        "last_watched_at": None,
        "play_count": 0,
        "last_played_at": None,
        "sent_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "follow_up_dates": [],
        "notes": data.get("notes", ""),
    }
    _consultations.append(consultation)
    _save_consultations()

    # Update the linked VC request status
    if data.get("request_id"):
        update_vc_request(data["request_id"], {
            "status": "sent",
            "consultation_id": consultation["id"],
        })

    return consultation


def get_consultations(status: Optional[str] = None) -> list[dict]:
    """Get all consultations, optionally filtered by status."""
    _load_consultations()
    _ensure_tokens()
    if status:
        return [c for c in _consultations if c["status"] == status]
    return _consultations


def get_consultation(consultation_id: int) -> Optional[dict]:
    """Get a single consultation by ID."""
    _load_consultations()
    _ensure_tokens()
    for c in _consultations:
        if c["id"] == consultation_id:
            return c
    return None


def _ensure_tokens():
    """Backfill an unguessable token for any legacy consultation missing one."""
    changed = False
    for c in _consultations:
        if not c.get("token"):
            c["token"] = secrets.token_urlsafe(24)
            c["token_expires_at"] = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=60)).isoformat()
            changed = True
    if changed:
        _save_consultations()


def get_consultation_by_token(token: str) -> Optional[dict]:
    """Get a single consultation by its unguessable share token."""
    if not token:
        return None
    _load_consultations()
    _ensure_tokens()
    for c in _consultations:
        if c.get("token") == token:
            return c
    return None


def record_watch_by_token(token: str) -> Optional[dict]:
    c = get_consultation_by_token(token)
    return record_watch(c["id"]) if c else None


def record_play_by_token(token: str) -> Optional[dict]:
    c = get_consultation_by_token(token)
    return record_play(c["id"]) if c else None


def update_consultation(consultation_id: int, updates: dict) -> Optional[dict]:
    """Update a consultation (watch status, resend, etc.)."""
    import datetime
    _load_consultations()
    for c in _consultations:
        if c["id"] == consultation_id:
            for key, value in updates.items():
                if key != "id":
                    c[key] = value
            c["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            _save_consultations()
            return c
    return None


def record_watch(consultation_id: int) -> Optional[dict]:
    """Record that a patient OPENED their consultation page."""
    import datetime
    _load_consultations()
    for c in _consultations:
        if c["id"] == consultation_id:
            c["watch_count"] = c.get("watch_count", 0) + 1
            c["last_watched_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            c["status"] = "watched"
            c["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            _save_consultations()
            return c
    return None


def record_play(consultation_id: int) -> Optional[dict]:
    """Record that the patient pressed PLAY on their consultation video."""
    import datetime
    _load_consultations()
    for c in _consultations:
        if c["id"] == consultation_id:
            c["play_count"] = c.get("play_count", 0) + 1
            c["last_played_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            c["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            _save_consultations()
            return c
    return None
