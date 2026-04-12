"""PII redaction utilities for safe logging."""

import hashlib


def redact_email(email: str) -> str:
    """Redact an email address for safe logging.

    Preserves the first 3 characters of the local part and the full domain
    so log entries remain useful for debugging without exposing full addresses.

    Examples:
        "john@example.com" -> "joh***@example.com"
        "al@b.co"          -> "al***@b.co"
        "a@b.co"           -> "a***@b.co"
        "invalid"          -> "inv***"
    """
    if not email or not isinstance(email, str):
        return "***"
    parts = email.split("@", 1)
    local = parts[0]
    # Show up to 3 chars of the local part; never expose the full address.
    prefix = local[:3]
    if len(parts) == 2:
        return f"{prefix}***@{parts[1]}"
    return f"{prefix}***"


def hash_email(email: str) -> str:
    """Return a short hash for log correlation without exposing the email.

    Examples:
        "john@example.com" -> "user_a8cfcd74"
    """
    if not email or not isinstance(email, str):
        return "user_unknown"
    digest = hashlib.sha256(email.lower().strip().encode()).hexdigest()[:8]
    return f"user_{digest}"


def redact_token(token: str) -> str:
    """Redact a token/credential for safe logging.

    Shows only the first 8 characters so log entries can be correlated
    without exposing the full secret value.

    Examples:
        "eyJhbGciOiJIUzI1NiJ9.abc..." -> "eyJhbGci..."
        "short"                         -> "short..."
        ""                              -> "***"
    """
    if not token or not isinstance(token, str):
        return "***"
    return f"{token[:8]}..."


def redact_identifier(value: str) -> str:
    """Generic redaction for any PII string, showing first char + masked.

    Examples:
        "John Doe" -> "J***"
        "" -> "***"
    """
    if not value or not isinstance(value, str):
        return "***"
    return f"{value[0]}***"
