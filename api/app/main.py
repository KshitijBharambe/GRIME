import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.database import SessionLocal
from app.middleware.global_rate_limit import GlobalRateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.request_body_limit import RequestBodyLimitMiddleware
from app.routes.upload import upload
from app.routes.auth import auth
from app.routes import rules
from app.routes import executions
from app.routes import processing
from app.routes import reports
from app.routes import issues
from app.routes import search
from app.routes import advanced_features
from app.routes import compartments
from app.routes import access_requests
from app.services.guest_cleanup import guest_cleanup_loop
from app.security.sandbox import validate_sandbox_config

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Conditional Sentry error monitoring
if settings.SENTRY_DSN:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.1,
            environment=settings.ENVIRONMENT,
        )
        logger.info("Sentry error monitoring enabled")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk not installed; skipping")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Validate sandbox security config before accepting traffic
    try:
        validate_sandbox_config()
        logger.info("Sandbox configuration validated successfully")
    except RuntimeError as e:
        logger.critical("Sandbox configuration validation failed: %s", e)
        raise

    cleanup_task = asyncio.create_task(guest_cleanup_loop(SessionLocal))
    logger.info("Started guest cleanup background task")
    yield
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Stopped guest cleanup background task")


app = FastAPI(
    title="Data Hygiene Tool API",
    description="API for data quality management and cleansing",
    version="1.0.0",
    redirect_slashes=True,  # Prevent automatic slash redirects that break POST requests
    lifespan=lifespan,
)

# Global exception handler for better error logging


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception on %s %s",
        request.method,
        request.url,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# Add CORS middleware (origins configurable via CORS_ORIGINS env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=[
        m.strip() for m in settings.CORS_ALLOW_METHODS.split(",") if m.strip()
    ],
    allow_headers=[
        h.strip() for h in settings.CORS_ALLOW_HEADERS.split(",") if h.strip()
    ],
)

# Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# Global rate limiting
app.add_middleware(
    GlobalRateLimitMiddleware,
    requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
)

# Request body size limiting (protects against oversized JSON payloads)
app.add_middleware(RequestBodyLimitMiddleware)

# Include routers
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(rules.router)
app.include_router(executions.router)
app.include_router(processing.router)
app.include_router(reports.router)
app.include_router(issues.router)
app.include_router(search.router)
app.include_router(advanced_features.router)
app.include_router(compartments.router)
app.include_router(access_requests.router)


@app.get("/")
def read_root():
    return {"message": "Data Hygiene Tool API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint with DB connectivity test."""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "healthy", "database": "connected"}
    except Exception:
        logger.exception("Health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "unavailable"},
        )
