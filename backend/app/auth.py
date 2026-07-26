"""VC Portal MVP — Admin authentication and route protection.

MVP approach: shared admin password + bearer token sessions.
HIPAA-ready upgrade path: replace with OAuth2/OIDC (e.g. Auth0, Clerk) before production.

Storage decisions:
- Sessions persisted on the Fly volume so logins survive restarts
- Password: prefer VC_ADMIN_PASSWORD_HASH (pbkdf2) when set; else legacy plaintext
  VC_ADMIN_PASSWORD compared with hmac.compare_digest (timing-safe). SHA-256
  double-hashing was removed — it added no salt and was fast to brute-force.
- Tokens are secrets.token_urlsafe(32), valid for 24 hours
"""
import os
import secrets
import hashlib
import hmac
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# --- Configuration ---
VC_ADMIN_PASSWORD = os.environ.get("VC_ADMIN_PASSWORD", "")
# Optional: "pbkdf2_sha256$iterations$salt_b64$hash_b64" from hash_admin_password()
VC_ADMIN_PASSWORD_HASH = os.environ.get("VC_ADMIN_PASSWORD_HASH", "").strip()
# When VC_ENV=production, auth fails CLOSED if no password is configured — a missing
# secret must never silently expose PHI. Outside production, an unset password = dev mode.
VC_ENV = os.environ.get("VC_ENV", "").strip().lower()
IS_PRODUCTION = VC_ENV in ("production", "prod")
TOKEN_EXPIRY_HOURS = 24
_PBKDF2_ITERATIONS = 260_000

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
        import os as _os
        tmp = _SESSIONS_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(_active_sessions))
        _os.replace(tmp, _SESSIONS_FILE)  # atomic — avoids corruption on concurrent writes
    except Exception:
        pass


_active_sessions: dict[str, dict] = _load_sessions()

security = HTTPBearer(auto_error=False)


def hash_admin_password(password: str, iterations: int = _PBKDF2_ITERATIONS) -> str:
    """Create a PBKDF2 password hash suitable for VC_ADMIN_PASSWORD_HASH."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256$%d$%s$%s" % (
        iterations,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(dk).decode("ascii"),
    )


def _verify_pbkdf2(password: str, encoded: str) -> bool:
    try:
        algo, iters_s, salt_b64, hash_b64 = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iters_s)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(hash_b64.encode("ascii"))
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def verify_admin_password(password: str) -> bool:
    """Verify the admin password against PBKDF2 hash or legacy plaintext env."""
    if VC_ADMIN_PASSWORD_HASH:
        return _verify_pbkdf2(password, VC_ADMIN_PASSWORD_HASH)
    if not VC_ADMIN_PASSWORD:
        # No password configured: allow only outside production (dev mode).
        # In production this returns False — never authenticate without a real secret.
        return not IS_PRODUCTION
    # Timing-safe plaintext compare (rotate to VC_ADMIN_PASSWORD_HASH ASAP).
    return hmac.compare_digest(password.encode("utf-8"), VC_ADMIN_PASSWORD.encode("utf-8"))


def create_session() -> dict:
    """Create a new admin session and return the token + expiry."""
    token = secrets.token_urlsafe(32)
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
    if not session or not session.get("is_valid"):
        return None
    try:
        expires = datetime.fromisoformat(session["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            session["is_valid"] = False
            _save_sessions()
            return None
    except Exception:
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


def revoke_session(token: str) -> None:
    invalidate_session(token)


async def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """FastAPI dependency that requires valid admin authentication.

    If neither VC_ADMIN_PASSWORD nor VC_ADMIN_PASSWORD_HASH is set:
    - production → 503 fail-closed
    - otherwise → dev mode allow-all
    """
    if not VC_ADMIN_PASSWORD and not VC_ADMIN_PASSWORD_HASH:
        if IS_PRODUCTION:
            raise HTTPException(
                status_code=503,
                detail="Server authentication is not configured.",
            )
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


def cleanup_expired_sessions() -> int:
    """Remove expired sessions from memory/volume."""
    now = datetime.now(timezone.utc)
    removed = 0
    for token, session in list(_active_sessions.items()):
        try:
            expires = datetime.fromisoformat(session["expires_at"])
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if now > expires or not session.get("is_valid"):
                del _active_sessions[token]
                removed += 1
        except Exception:
            del _active_sessions[token]
            removed += 1
    if removed:
        _save_sessions()
    return removed


def get_bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None
