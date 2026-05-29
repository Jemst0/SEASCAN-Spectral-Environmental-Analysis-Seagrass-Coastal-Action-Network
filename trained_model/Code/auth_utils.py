import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt

PBKDF2_ITERATIONS = 120000
HASH_NAME = "sha256"


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    """Hash a password using PBKDF2-HMAC with a random salt."""
    if salt is None:
        salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac(HASH_NAME, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{base64.b64encode(salt).decode('ascii')}${base64.b64encode(pw_hash).decode('ascii')}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt_b64, hash_b64 = stored_hash.split("$", 1)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except Exception:
        return False

    candidate = hashlib.pbkdf2_hmac(HASH_NAME, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(candidate, expected)


def create_access_token(username: str, role: str, secret: str, expires_minutes: int) -> str:
    """Create a signed JWT access token."""
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str) -> dict:
    """Decode and validate a JWT access token."""
    return jwt.decode(token, secret, algorithms=["HS256"])
