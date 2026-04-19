"""
Application configuration and constants.

Settings are loaded from environment variables via Pydantic BaseSettings.
Import `settings` for env-driven config, or individual constants for magic numbers.
"""

from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = ""

    # Auth
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # App
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    APP_NAME: str = "GRIME"
    PUBLIC_SIGNUP_ENABLED: bool = False

    # CORS — comma-separated origins
    CORS_ORIGINS: str = (
        "https://grime.kshitij.space,https://kshitij.space,http://localhost:3000,http://localhost:8000"
    )
    CORS_ORIGIN_REGEX: str = (
        r"https://.*-hzy3s-projects\.vercel\.app|https://.*\.kshitij\.space"
    )
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    CORS_ALLOW_HEADERS: str = (
        "Authorization,Content-Type,Accept,Origin,X-Requested-With"
    )

    # Email
    RESEND_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "noreply@datahygiene.com"

    # Redis
    REDIS_URL: Optional[str] = None

    # Sentry
    SENTRY_DSN: Optional[str] = None

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 100

    # Storage
    STORAGE_TYPE: str = "local"

    model_config = {"env_file": ".env", "case_sensitive": True}

    @model_validator(mode="after")
    def validate_security_requirements(self):
        is_production = self.ENVIRONMENT.lower() == "production"
        if is_production:
            if not self.JWT_SECRET_KEY:
                raise ValueError("JWT_SECRET_KEY must be set in production")
            if not self.DATABASE_URL:
                raise ValueError("DATABASE_URL must be set in production")
        return self


settings = Settings()


# ---------------------------------------------------------------------------
# Criticality / DQI
# ---------------------------------------------------------------------------
CRITICALITY_WEIGHTS = {"low": 1, "medium": 2, "high": 3, "critical": 5}

# ---------------------------------------------------------------------------
# Metric status
# ---------------------------------------------------------------------------
METRIC_STATUS_OK = "ok"
METRIC_STATUS_NOT_AVAILABLE = "not_available"
METRIC_NO_EXECUTION_MESSAGE = "Run an execution to calculate data quality"


# ---------------------------------------------------------------------------
# Database table references for foreign keys
# ---------------------------------------------------------------------------
class DatabaseTableRefs:
    """Foreign key table references used in SQLAlchemy models."""

    USERS_ID = "users.id"
    ORGANIZATIONS_ID = "organizations.id"
    DATASETS_ID = "datasets.id"
    DATASET_VERSIONS_ID = "dataset_versions.id"
    EXECUTIONS_ID = "executions.id"
    RULES_ID = "rules.id"
    DATA_SOURCES_ID = "data_sources.id"


# ---------------------------------------------------------------------------
# Common error messages
# ---------------------------------------------------------------------------
class ErrorMessages:
    """Common error messages used across the application."""

    DATASET_NOT_FOUND = "Dataset not found"
    FILE_NOT_FOUND = "File not found"
    UNAUTHORIZED = "Unauthorized"
    INVALID_CREDENTIALS = "Invalid credentials"
    ORGANIZATION_NOT_FOUND = "Organization not found"
    USER_NOT_FOUND = "User not found"
    RULE_NOT_FOUND = "Rule not found"
    EXECUTION_NOT_FOUND = "Execution not found"


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_ISSUES_PER_REQUEST = 1000
MAX_SEARCH_RESULTS_PER_CATEGORY = 50

# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# ---------------------------------------------------------------------------
# Rule engine / data processing
# ---------------------------------------------------------------------------
CHUNKED_VALIDATION_THRESHOLD = 10_000  # rows; above this use chunked mode
DEFAULT_CHUNK_SIZE = 5_000  # rows per chunk
MAX_PARALLEL_WORKERS = 4  # ThreadPoolExecutor workers for execution

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
DEFAULT_PRESIGNED_URL_EXPIRY = 3_600  # seconds (1 hour)
MAX_PRESIGNED_URL_EXPIRY = 604_800  # seconds (7 days)
MIN_PRESIGNED_URL_EXPIRY = 60  # seconds
DEFAULT_STORAGE_LIST_MAX = 100
MAX_STORAGE_LIST_MAX = 1_000

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
DEFAULT_SEARCH_LIMIT = 10
MAX_SEARCH_LIMIT = 50

# ---------------------------------------------------------------------------
# Statistical / Quality Analysis
# ---------------------------------------------------------------------------
IQR_Q1 = 0.25
IQR_Q3 = 0.75
IQR_MULTIPLIER = 1.5
FLOAT_COMPARISON_TOLERANCE = 0.01
CONSISTENCY_PENALTY_SCORE = 90

# ---------------------------------------------------------------------------
# Data Import
# ---------------------------------------------------------------------------
DEFAULT_IMPORT_CHUNK_SIZE = 10_000  # rows per chunk when reading files
MEMORY_THRESHOLD_MB = 150  # chunked reader memory threshold
LARGE_FILE_MEMORY_THRESHOLD_MB = 50  # trigger chunked read above this
TYPE_INFERENCE_SAMPLE_SIZE = 10  # rows sampled for type inference

# ---------------------------------------------------------------------------
# Anomaly Detection Defaults
# ---------------------------------------------------------------------------
DEFAULT_ANOMALY_THRESHOLD = 0.5
ANOMALY_SCORE_SCALE = 100
DEFAULT_ISOLATION_FOREST_ESTIMATORS = 100
DEFAULT_CONTAMINATION = 0.1
DEFAULT_SVM_NU = 0.1
DEFAULT_LOF_NEIGHBORS = 20
DEFAULT_RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# Database Connection Pool
# ---------------------------------------------------------------------------
DB_POOL_SIZE = 3
DB_MAX_OVERFLOW = 5
DB_POOL_TIMEOUT_SECONDS = 30
DB_POOL_RECYCLE_SECONDS = 1800  # 30 minutes
DB_STATEMENT_TIMEOUT_MS = 30_000  # 30 seconds

# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------
RATE_LIMIT_WINDOW_SECONDS = 60

# ---------------------------------------------------------------------------
# Guest Limits
# ---------------------------------------------------------------------------
GUEST_SESSION_TTL_HOURS = 24
GUEST_UPLOAD_LIMIT = 10
GUEST_EXECUTION_LIMIT = 50
GUEST_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
GUEST_CLEANUP_INTERVAL_SECONDS = 900  # 15 minutes

# ---------------------------------------------------------------------------
# Parallel Execution Heuristics
# ---------------------------------------------------------------------------
MIN_RULES_FOR_PARALLEL = 3
MIN_DATASET_SIZE_FOR_PARALLEL = 1_000
MAX_MEMORY_MB_FOR_PARALLEL = 1_000  # 1 GB

# ---------------------------------------------------------------------------
# Validation Parameter Limits
# ---------------------------------------------------------------------------
MAX_RULE_COLUMNS = 100
MAX_ALLOWED_VALUES = 1_000
DEFAULT_MAX_SUGGESTIONS = 10

# ---------------------------------------------------------------------------
# Payload / Request Body Limits
# ---------------------------------------------------------------------------
MAX_JSON_BODY_BYTES = 10 * 1024 * 1024  # 10 MB max JSON body
MAX_JSON_ARRAY_ITEMS = 100_000  # max items in a top-level JSON array
MAX_JSON_KEY_LENGTH = 256  # max length of any JSON key / column name
MAX_JSON_STRING_VALUE_LENGTH = 50_000  # max length of a single string value
MAX_JSON_KEYS_PER_OBJECT = 500  # max keys in a single JSON object
MAX_FILENAME_LENGTH = 255  # max upload filename length

# ---------------------------------------------------------------------------
# Phone / IBAN Validation
# ---------------------------------------------------------------------------
US_PHONE_DIGITS = 10
US_PHONE_WITH_COUNTRY_DIGITS = 11
IBAN_MIN_LENGTH = 15
IBAN_MAX_LENGTH = 34
