# GRIME (Generalized Rule & Integrity Management Engine)

A full-stack data quality platform for uploading, profiling, validating, and cleaning structured datasets. Define rules, run executions, review flagged issues, apply fixes, and export clean data — all with multi-tenant organization support and a role-based access model.

---

## Overview

**Backend:** FastAPI · Python 3.13 · SQLAlchemy · PostgreSQL · Alembic · Celery · Redis  
**Frontend:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · shadcn/ui  
**Storage:** MinIO (S3-compatible) — swappable for GCS or AWS S3 in production  
**Auth:** JWT (HS256) with role-based access control  
**Infra:** Docker Compose for local dev and production simulation · Terraform configs included

---

## Features

- **Dataset Management** — Upload CSV/Excel files, track versions with full lineage, profile columns (types, nullability, row/column counts)
- **Rule Engine** — 12 rule kinds including missing data, regex, value lists, cross-field validation, statistical outliers, distribution checks, and ML-based anomaly detection
- **Rule Versioning** — Every rule edit creates a new version; parent/child lineage and rule families are preserved
- **Executions** — Run rule sets against dataset versions; get per-rule issue counts, rows/columns flagged, and a Data Quality Index (DQI)
- **Issues & Fixes** — Review flagged rows with suggested fixes, apply fixes to produce a new dataset version, re-run rules post-fix
- **Organizations & Multi-Tenancy** — Isolated workspaces per organization; invite members via email token; share rules across orgs with scoped permissions (view / use / clone)
- **Compartments** — Sub-org access groupings with hierarchical paths and inheritable membership
- **Access Requests** — Structured workflow for password changes, role changes, and compartment access, with an admin approval queue
- **Guest Mode** — Time-limited sessions with upload/execution quotas and read-only restrictions on mutations
- **Advanced Features** — Rule templates, ML model registry, anomaly scoring, dataset profiling, statistical metrics, and debug sessions
- **Exports** — Export cleaned dataset versions as CSV, Excel, JSON, or push to a data lake / API target
- **Security** — Global rate limiting, request body size limits, security headers middleware, PII redaction in logs, sandbox validation on startup, optional Sentry integration

---

## Project Structure

```
API/
├── api/
│   └── app/
│       ├── main.py              # FastAPI app, middleware, router registration
│       ├── auth.py              # JWT issuance, OrgContext, role dependencies
│       ├── models.py            # SQLAlchemy ORM models
│       ├── schemas.py           # Pydantic request/response schemas
│       ├── database.py          # DB session and Base
│       ├── celery_app.py        # Celery worker config
│       ├── core/
│       │   └── config.py        # Pydantic settings + all constants
│       ├── routes/              # One module per feature area
│       ├── services/            # Business logic (rule engine, imports, exports, ML…)
│       ├── middleware/          # Rate limiting, security headers, body size
│       ├── security/            # Sandbox config validation
│       ├── storage/             # MinIO / GCS adapter
│       ├── utils/               # PII helpers, misc
│       └── validators/          # Input validators
│   ├── migrations/              # Alembic migration files
│   └── tests/
├── frontend/                    # Next.js app
├── docker/                      # Compose files (dev + prod-sim)
├── terraform/                   # Infrastructure as code
├── supabase/                    # Supabase config (if used)
├── scripts/                     # Shell helpers
├── Makefile                     # All dev/ops commands
├── pyproject.toml
└── vercel.json
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Make

### Local Development

```bash
# First-time setup (copies .env files)
make setup

# Start the stack with hot reload
make dev
```

Services will be available at:

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:3000      |
| API                | http://localhost:8000      |
| API Docs (Swagger) | http://localhost:8000/docs |
| MinIO Console      | http://localhost:9001      |
| PostgreSQL         | localhost:5432             |

```bash
# Run database migrations
make db-migrate

# Tail logs
make logs

# Run tests
make test
```

### Production Simulation

Builds production-grade Docker images and runs them locally against a separate DB and config:

```bash
make prod-sim
```

---

## Environment Variables

Copy `.env.example` to `.env` for local dev. Key variables:

| Variable                | Description                                   |
| ----------------------- | --------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                  |
| `JWT_SECRET_KEY`        | **Required in production.** HS256 signing key |
| `STORAGE_TYPE`          | `local`, `minio`, or `gcs`                    |
| `REDIS_URL`             | Redis connection for Celery and rate limiting |
| `CORS_ORIGINS`          | Comma-separated allowed origins               |
| `RATE_LIMIT_PER_MINUTE` | Global request rate limit (default: 100)      |
| `SENTRY_DSN`            | Optional Sentry error monitoring              |
| `RESEND_API_KEY`        | Email delivery for invites                    |

See `.env.prod-sim.example` for production-level configuration reference.

---

### Authentication

All endpoints (except login/register/guest) require a Bearer token:

```
Authorization: Bearer <access_token>
```

Tokens carry `user_id`, `organization_id`, and `role`. The server validates membership and role on every request via the `OrgContext` dependency.

### Roles

| Role      | Access                                 |
| --------- | -------------------------------------- |
| `owner`   | Full access including org management   |
| `admin`   | Member management, all data operations |
| `analyst` | Rule creation and execution            |
| `viewer`  | Read-only                              |

---

## Rule Kinds

| Kind                     | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `missing_data`           | Null / empty value checks                      |
| `standardization`        | Format normalization (e.g. phone, date)        |
| `value_list`             | Allowed values enumeration                     |
| `length_range`           | String / numeric range bounds                  |
| `cross_field`            | Conditional logic across columns               |
| `char_restriction`       | Character whitelist/blacklist                  |
| `regex`                  | Pattern matching                               |
| `custom`                 | Arbitrary expression                           |
| `statistical_outlier`    | IQR-based outlier detection                    |
| `distribution_check`     | Expected distribution validation               |
| `correlation_validation` | Cross-column correlation checks                |
| `ml_anomaly`             | Isolation Forest / One-Class SVM / LOF scoring |

---

## Makefile Reference

```bash
make dev              # Start local dev stack
make stop             # Stop containers
make logs             # Tail all logs
make db-migrate       # Apply pending migrations
make db-migrate-create MSG="desc"  # Generate new migration
make db-shell         # PostgreSQL interactive shell
make db-backup        # Dump DB to ./backups/
make test             # Run full test suite
make test-coverage    # Tests with HTML coverage report
make lint             # Black + Ruff + mypy
make format           # Auto-format code
make prod-sim         # Build + run production simulation
make health-check     # Curl all services
make clean-all        # Stop, remove volumes, prune Docker
```

---

## Health Check

```
GET /health
```

Returns `200` with `{ "status": "healthy", "database": "connected" }` when the API and DB are operational. Returns `503` on DB failure.

---

## License

TBD
