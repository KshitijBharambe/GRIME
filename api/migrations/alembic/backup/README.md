# Backup Migrations — Archival Only

## Purpose

This directory contains **archived migration files** that have been superseded,
consolidated, or otherwise removed from the active migration chain.

They are kept here **for reference only** — to preserve historical context about
past schema evolution decisions.

## Important Warnings

- **Do NOT execute** any migration in this directory against a live database.
- **Do NOT move** files from this directory back into `versions/` without
  regenerating revision IDs and verifying the dependency chain.
- These files are **not referenced** by Alembic's revision graph. Running
  `alembic history` or `alembic upgrade head` will never touch them.
- Schema reproducibility must always come from the canonical chain in
  `alembic/versions/`, never from backup files.

## When to Add Files Here

- When a migration is superseded by a squashed/consolidated migration.
- When a migration was created in error and reverted before reaching production.
- When migration history is rewritten (e.g., after a `merge` + `squash` cycle).

## Naming Convention

Prefix the original filename with the date it was archived:

```
YYYY-MM-DD__<original_filename>.py
```

For example:

```
2025-10-20__04ca9eab8c98_create_employee_table.py
```

## Relationship to `versions/`

```
alembic/
├── versions/          ← Canonical, executable migration chain
│   ├── 04ca9eab8c98_create_employee_table.py
│   └── ...
├── backup/            ← Archived, non-executable (this directory)
│   ├── README.md
│   └── ...
└── env.py
```
