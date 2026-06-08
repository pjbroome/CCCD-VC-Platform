"""VC Portal MVP — Admin authentication and route protection.

MVP approach: shared admin password + bearer token sessions.
HIPAA-ready upgrade path: replace with OAuth2/OIDC (e.g. Auth0, Clerk) before production.

Storage decisions:
- Sessions stored in-memory (lost on restart — acceptable for MVP)
- Password stored as env var VC_ADMIN_PASSWORD (hashed comparison)
- Tokens are UUID4, valid for 24 hours
"""
import os
import uuid
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# --- Configuration ---
VC_ADMIN_PASSWORD = os.environ.get("VC_ADMIN_PASSWORD", "")
TOKEN_EXPIRY_HOURS = 24

# --- Session store (persisted to the volume so logins survive restarts) ---
try:
    from app.slide_sorter import _VC_DIR as _vc_dir
    _SESSIONS_FILE = _vc_dir / "admin_sessions.json"
except Exception:  # pragma: no cover - fallback if volume module unavailable
    _SESSIONS_FILE = None


def _load_sessions() -> dict:
    if _SESSIONS_FILE and _SESSIONS_FILE.exists():
        try:
            import json
            return json.loads(_SESSIONS_FILE.read_text())
        except Exception:
            return {}
    return {}


def _save_sessions() -> None:
    if not _SESSIONS_FILE:
        return
    try:
        import json
        import os
        tmp = _SESSIONS_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(_active_sessions))
        os.replace(tmp, _SESSIONS_FILE)  # atomic — avoids corruption on concurrent writes
    except Exception:
        pass


_active_sessions: dict[str, dict] = _load_sessions()

security = HTTPBearer(auto_error=False)


def _hash_password(password: str) -> str:
    """Hash a password with SHA-256 for comparison."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_admin_password(password: str) -> bool:
    """Verify the admin password against the stored hash."""
    if not VC_ADMIN_PASSWORD:
        # If no password is set, allow access (dev mode)
        return True
    return hmac.compare_digest(
        _hash_password(password),
        _hash_password(VC_ADMIN_PASSWORD),
    )


def create_session() -> dict:
    """Create a new admin session and return the token + expiry."""
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=TOKEN_EXPIRY_HOURS)

    session = {
        "token": token,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_valid": True,
    }
    _active_sessions[token] = session
    _save_sessions()
    return session


def validate_token(token: str) -> Optional[dict]:
    """Validate a bearer token and return the session if valid."""
    session = _active_sessions.get(token)
    if not session:
        return None
    if not session.get("is_valid"):
        return None

    # Check expiry
    expires_at = datetime.fromisoformat(session["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        session["is_valid"] = False
        return None

    return session


def invalidate_session(token: str) -> bool:
    """Invalidate (logout) a session."""
    session = _active_sessions.get(token)
    if session:
        session["is_valid"] = False
        _save_sessions()
        return True
    return False


async def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """FastAPI dependency that requires valid admin authentication.
    
    Usage:
        @app.get("/admin/endpoint")
        async def protected_endpoint(session: dict = Depends(require_admin)):
            ...
    
    If VC_ADMIN_PASSWORD is not set, all requests are allowed (dev mode).
    """
    # Dev mode: no password configured, allow all
    if not VC_ADMIN_PASSWORD:
        return {"token": "dev-mode", "is_valid": True, "dev_mode": True}

    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Use POST /admin/login to get a token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = validate_token(credentials.credentials)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return session


def cleanup_expired_sessions():
    """Remove expired sessions from memory."""
    now = datetime.now(timezone.utc)
    expired_tokens = [
        token for token, session in _active_sessions.items()
        if datetime.fromisoformat(session["expires_at"]) < now
    ]
    for token in expired_tokens:
        del _active_sessions[token]
