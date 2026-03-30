"""VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.

The VC agent calls these functions to pull the right before/after slides
for each guest based on their concerns, desired treatments, and context.
"""
import json
import os
from typing import Optional
from pathlib import Path

# Load indexed catalog on import
_CATALOG_PATH = Path(__file__).parent / "vc_slides" / "indexed_catalog.json"
_IMAGES_DIR = Path(__file__).parent / "vc_slides" / "slide_images"
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
