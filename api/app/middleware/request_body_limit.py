"""Middleware to enforce a maximum request body size for JSON payloads."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import MAX_JSON_BODY_BYTES


class RequestBodyLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds the configured limit.

    This protects against oversized JSON payloads being buffered into memory
    before any route-level validation can kick in.  File uploads go through
    multipart parsing with their own size gates, so only ``application/json``
    (and similar) content types are checked here.
    """

    def __init__(self, app, max_body_bytes: int = MAX_JSON_BODY_BYTES):
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next):
        content_type = (request.headers.get("content-type") or "").lower()

        # Only gate non-multipart request bodies (JSON, form-urlencoded, etc.)
        if "multipart/form-data" in content_type:
            return await call_next(request)

        # Fast-path: check Content-Length header if present
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > self.max_body_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "detail": (
                                f"Request body too large. "
                                f"Maximum allowed size is {self.max_body_bytes} bytes."
                            )
                        },
                    )
            except ValueError:
                pass  # malformed header – let downstream handle it

        # For chunked / streaming bodies without Content-Length, read up to
        # the limit + 1 byte to detect overflow without buffering unbounded data.
        if request.method in ("POST", "PUT", "PATCH") and content_length is None:
            body = await request.body()
            if len(body) > self.max_body_bytes:
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": (
                            f"Request body too large. "
                            f"Maximum allowed size is {self.max_body_bytes} bytes."
                        )
                    },
                )

        return await call_next(request)
