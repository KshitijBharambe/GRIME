# Migrations

This directory contains Alembic database migrations for the Data Hygiene Toolkit.

## Directory Structure

```
api/migrations/
├── alembic/
│   ├── versions/        ← Canonical, executable migration chain (run by Alembic)
│   ├── backup/          ← Archived migrations — NOT run by Alembic (reference only)
│   │   └── README.md    ← Archival conventions for backup files
│   └── env.py
├── alembic.ini
├── MIGRATION_POLICY.md  ← Full policy, CI checks, and best practices
└── README.md            ← This file
```

## Key Rules

- **`alembic/versions/`** — the only directory Alembic scans for migrations. Every
  file here must be part of a single, linear revision chain with no unresolved heads.
- **`alembic/backup/`** — archival only. Files here are never executed by Alembic.
  They exist to preserve historical context. `alembic upgrade head` and
  `alembic history` will never reference them.
- **Merge migrations** (`down_revision` is a tuple) are intentionally empty
  (`pass`-only `upgrade`/`downgrade`). They exist solely to reunify divergent heads
  and must never contain schema changes.

## CI Requirements

CI must verify:

1. `alembic heads` returns exactly **one** revision (no unresolved multiple heads).
2. No file path under `alembic/backup/` appears in the active revision history.
3. Non-merge migrations have non-empty `upgrade()` and `downgrade()` bodies.

See `MIGRATION_POLICY.md` for the full CI script examples and checklist.

## Quick Reference

```bash
# Create a new migration
cd api/migrations && alembic revision --autogenerate -m "describe the change"

# Resolve multiple heads (after merging two branches that each added a migration)
cd api/migrations && alembic merge -m "Merge <a> with <b>" <rev_a> <rev_b>

# Apply all pending migrations
cd api/migrations && alembic upgrade head

# Check current heads (should be exactly 1)
cd api/migrations && alembic heads

# View full history
cd api/migrations && alembic history --verbose
```
