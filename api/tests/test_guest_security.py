from __future__ import annotations

import asyncio
import io
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request
from starlette.datastructures import UploadFile

from app.auth import get_org_context, OrgContext
from app.models import AccountType, UserRole, Organization, User
from app.routes.upload.upload import (
    _get_upload_size_limit_bytes,
    _read_file_with_size_limit,
)
from app.core.config import GUEST_MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_BYTES


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeSession:
    def __init__(self, user, organization, membership):
        self._map = {
            User: user,
            Organization: organization,
        }
        self._membership = membership

    def query(self, model):
        if model.__name__ == "OrganizationMember":
            return _FakeQuery(self._membership)
        return _FakeQuery(self._map.get(model))


def _request(method: str, path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [],
            "query_string": b"",
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


def _credentials() -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")


def test_expired_guest_rejected_server_side():
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id="guest-user",
        email="guest@example.com",
        is_active=True,
        is_guest=True,
        guest_expires_at=now - timedelta(minutes=1),
    )
    org = SimpleNamespace(
        id="guest-org",
        name="Guest Org",
        is_active=True,
        account_type=AccountType.GUEST,
    )
    membership = SimpleNamespace(role=UserRole.admin)
    db = _FakeSession(user, org, membership)

    payload = {
        "sub": user.id,
        "organization_id": org.id,
        "role": UserRole.admin.value,
        "account_type": AccountType.GUEST.value,
    }

    with patch("app.auth.verify_token", return_value=payload):
        with pytest.raises(HTTPException) as exc_info:
            get_org_context(
                request=_request("GET", "/data/datasets"),
                credentials=_credentials(),
                db=db,
            )

    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_guest_mutation_blocked_for_sensitive_endpoint():
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id="guest-user",
        email="guest@example.com",
        is_active=True,
        is_guest=True,
        guest_expires_at=now + timedelta(minutes=30),
    )
    org = SimpleNamespace(
        id="guest-org",
        name="Guest Org",
        is_active=True,
        account_type=AccountType.GUEST,
    )
    membership = SimpleNamespace(role=UserRole.admin)
    db = _FakeSession(user, org, membership)

    payload = {
        "sub": user.id,
        "organization_id": org.id,
        "role": UserRole.admin.value,
        "account_type": AccountType.GUEST.value,
    }

    with patch("app.auth.verify_token", return_value=payload):
        with pytest.raises(HTTPException) as exc_info:
            get_org_context(
                request=_request("POST", "/processing/datasets/123/validate"),
                credentials=_credentials(),
                db=db,
            )

    assert exc_info.value.status_code == 403
    assert (
        "guest accounts cannot perform this mutation" in exc_info.value.detail.lower()
    )


def test_guest_upload_limit_allows_5mb_rejects_over_5mb():
    user = SimpleNamespace(id="guest-user", email="guest@example.com")
    org = SimpleNamespace(id="guest-org", name="Guest Org")
    guest_context = OrgContext(
        user=user,
        organization=org,
        role=UserRole.admin,
        account_type=AccountType.GUEST,
    )

    upload_limit = _get_upload_size_limit_bytes(guest_context)
    assert upload_limit == GUEST_MAX_FILE_SIZE_BYTES

    at_limit = UploadFile(
        file=io.BytesIO(b"a" * upload_limit),
        filename="guest-ok.csv",
        size=upload_limit,
    )
    at_limit_bytes = asyncio.run(_read_file_with_size_limit(at_limit, upload_limit))
    assert len(at_limit_bytes) == upload_limit

    over_limit = UploadFile(
        file=io.BytesIO(b"a" * (upload_limit + 1)),
        filename="guest-too-large.csv",
        size=upload_limit + 1,
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(_read_file_with_size_limit(over_limit, upload_limit))

    assert exc_info.value.status_code == 413


def test_non_guest_upload_limit_unchanged():
    user = SimpleNamespace(id="regular-user", email="member@example.com")
    org = SimpleNamespace(id="org", name="Org")
    org_context = OrgContext(
        user=user,
        organization=org,
        role=UserRole.admin,
        account_type=AccountType.ORGANIZATION,
    )

    assert _get_upload_size_limit_bytes(org_context) == MAX_FILE_SIZE_BYTES
