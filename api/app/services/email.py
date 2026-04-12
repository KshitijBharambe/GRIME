"""Email service for sending invitations and notifications."""

import logging
import os
from typing import Optional

from app.utils.pii import redact_email

logger = logging.getLogger(__name__)

# Email provider config
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@datahygiene.com")
APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send email via configured provider. Returns True if sent."""
    if RESEND_API_KEY:
        return await _send_via_resend(to, subject, html)
    elif SENDGRID_API_KEY:
        return await _send_via_sendgrid(to, subject, html)
    else:
        logger.warning(
            f"No email provider configured. Would send to {redact_email(to)}: {subject}"
        )
        return False


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    """Send via Resend API."""
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            if response.status_code == 200:
                logger.info(f"Email sent to {redact_email(to)} via Resend")
                return True
            else:
                logger.error(f"Resend error: {response.status_code} {response.text}")
                return False
    except Exception:
        logger.exception("Failed to send email via Resend")
        return False


async def _send_via_sendgrid(to: str, subject: str, html: str) -> bool:
    """Send via SendGrid API."""
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": FROM_EMAIL},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}],
                },
            )
            if response.status_code in (200, 202):
                logger.info(f"Email sent to {redact_email(to)} via SendGrid")
                return True
            else:
                logger.error(f"SendGrid error: {response.status_code} {response.text}")
                return False
    except Exception:
        logger.exception("Failed to send email via SendGrid")
        return False


async def send_invite_email(
    to_email: str,
    org_name: str,
    inviter_name: str,
    invite_token: Optional[str] = None,
) -> bool:
    """Send organization invitation email."""
    invite_url = f"{APP_URL}/auth/accept-invite"
    if invite_token:
        invite_url += f"?token={invite_token}"

    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join {org_name}</h2>
        <p>{inviter_name} has invited you to join <strong>{org_name}</strong> on Data Hygiene Toolkit.</p>
        <p>
            <a href="{invite_url}"
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: 600;">
                Accept Invitation
            </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
            If you don't have an account, you'll be able to create one when you accept the invitation.
        </p>
    </div>
    """

    return await send_email(to_email, f"Invitation to join {org_name}", html)
