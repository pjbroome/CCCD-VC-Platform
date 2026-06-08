"""VC Portal MVP — Pydantic models for request schema, workflow statuses, and admin auth.

This module defines the canonical data model for the VC portal workflow:
patient submits → staff reviews → deck built → recording ready → approved → sent
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from enum import Enum
from datetime import datetime, timezone


# --- Workflow Status Enum ---

class RequestStatus(str, Enum):
    """Workflow statuses for a VC request.
    
    Flow: new → under_review → deck_built → recording_ready → approved → sent
    Legacy alias: pending = new (kept for backward-compat with seed data)
    """
    NEW = "new"
    PENDING = "pending"  # legacy alias — treated identically to NEW
    UNDER_REVIEW = "under_review"
    DECK_BUILT = "deck_built"
    RECORDING_READY = "recording_ready"
    APPROVED = "approved"
    SENT = "sent"


# Valid status transitions — permissive for MVP (staff can skip steps when needed)
VALID_STATUS_TRANSITIONS: dict[RequestStatus, list[RequestStatus]] = {
    RequestStatus.NEW: [RequestStatus.UNDER_REVIEW, RequestStatus.DECK_BUILT, RequestStatus.RECORDING_READY, RequestStatus.APPROVED, RequestStatus.SENT],
    RequestStatus.PENDING: [RequestStatus.UNDER_REVIEW, RequestStatus.DECK_BUILT, RequestStatus.RECORDING_READY, RequestStatus.APPROVED, RequestStatus.SENT, RequestStatus.NEW],
    RequestStatus.UNDER_REVIEW: [RequestStatus.DECK_BUILT, RequestStatus.RECORDING_READY, RequestStatus.APPROVED, RequestStatus.NEW],
    RequestStatus.DECK_BUILT: [RequestStatus.RECORDING_READY, RequestStatus.APPROVED, RequestStatus.SENT, RequestStatus.UNDER_REVIEW],
    RequestStatus.RECORDING_READY: [RequestStatus.APPROVED, RequestStatus.SENT, RequestStatus.DECK_BUILT],
    RequestStatus.APPROVED: [RequestStatus.SENT, RequestStatus.RECORDING_READY],
    RequestStatus.SENT: [RequestStatus.APPROVED, RequestStatus.RECORDING_READY],  # allow re-approve / re-record
}


def is_valid_transition(current: RequestStatus, target: RequestStatus) -> bool:
    """Check if a status transition is allowed."""
    return target in VALID_STATUS_TRANSITIONS.get(current, [])


# --- Patient Request Models ---

class VCRequestCreate(BaseModel):
    """Schema for creating a new VC request (patient intake form submission)."""
    first_name: str = Field(..., min_length=1, max_length=100, description="Patient first name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Patient last name")
    email: str = Field(..., description="Patient email address")
    phone: str = Field(..., description="Patient mobile phone number")
    date_of_birth: Optional[str] = Field(None, description="Patient date of birth (YYYY-MM-DD)")
    city: Optional[str] = Field(None, max_length=100, description="Patient city")
    state: Optional[str] = Field(None, max_length=50, description="Patient state")
    concern: str = Field(..., min_length=1, description="Dental concern / consult reason")
    consent_acknowledged: bool = Field(..., description="Patient consent acknowledgement")
    photos: list[str] = Field(default_factory=list, description="List of uploaded photo file paths/URLs")
    referral_source: Optional[str] = Field(None, max_length=200, description="How the patient heard about us")
    source_url: Optional[str] = Field(None, max_length=500, description="Referrer / landing URL for attribution")
    website: Optional[str] = Field("", description="Honeypot — must stay empty; bots fill it")


class VCRequestUpdate(BaseModel):
    """Schema for updating a VC request (staff actions)."""
    status: Optional[RequestStatus] = Field(None, description="New workflow status")
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    concern: Optional[str] = None
    notes: Optional[str] = Field(None, description="Internal staff notes")
    deck_id: Optional[int] = Field(None, description="Associated recording deck ID")
    consultation_id: Optional[int] = Field(None, description="Associated consultation/video ID")
    photos: Optional[list[str]] = Field(None, description="Patient photo paths (e.g. after staff rotate/resize)")


class VCRequestRecord(BaseModel):
    """Full VC request record as stored and returned by the API."""
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    concern: str
    consent_acknowledged: bool = True
    photos: list[str] = []
    status: RequestStatus = RequestStatus.NEW
    notes: str = ""
    deck_id: Optional[int] = None
    consultation_id: Optional[int] = None
    created_at: str = ""
    updated_at: str = ""


# --- Consultation Models ---

class ConsultationCreate(BaseModel):
    """Schema for creating a consultation (linking video to request)."""
    request_id: Optional[int] = Field(None, description="Linked VC request ID")
    patient_name: str = ""
    email: str = ""
    phone: str = ""
    concerns: list[str] = []
    photos: list[str] = []
    slide_numbers: list[int] = []
    presentation_name: str = ""
    script: str = ""
    script_status: str = "draft"
    video_url: str = ""
    clone_video_url: str = ""
    video_source: str = "doctor"
    summary_slide_data: Optional[dict] = None
    training_video_ids: list[str] = []
    notes: str = ""


class ConsultationUpdate(BaseModel):
    """Schema for updating a consultation."""
    status: Optional[str] = None
    video_url: Optional[str] = None
    clone_video_url: Optional[str] = None
    video_source: Optional[str] = None
    script: Optional[str] = None
    script_status: Optional[str] = None
    notes: Optional[str] = None


# --- Photo Upload Models ---

class PhotoUploadResponse(BaseModel):
    """Response after uploading a patient photo."""
    filename: str
    path: str
    url: str
    size_bytes: int


# --- Admin Auth Models ---

class AdminLoginRequest(BaseModel):
    """Login request for admin/staff access."""
    password: str = Field(..., description="Admin password")


class AdminLoginResponse(BaseModel):
    """Login response with session token."""
    token: str
    expires_at: str
    message: str = "Login successful"


class AdminSession(BaseModel):
    """Active admin session."""
    token: str
    created_at: str
    expires_at: str
    is_valid: bool = True


# --- Status Transition Models ---

class StatusTransitionRequest(BaseModel):
    """Request to transition a VC request to a new status."""
    status: RequestStatus = Field(..., description="Target workflow status")
    notes: Optional[str] = Field(None, description="Optional note about the transition")


class StatusTransitionResponse(BaseModel):
    """Response after a status transition."""
    request_id: int
    previous_status: RequestStatus
    new_status: RequestStatus
    transitioned_at: str
    notes: Optional[str] = None
