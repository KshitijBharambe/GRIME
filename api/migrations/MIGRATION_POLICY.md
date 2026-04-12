# Migration Policy

This document defines the policies and best practices for managing Alembic
database migrations in this project.

---

## 1. General Rules

- Every migration in `alembic/versions/` **must** be part of a single linear
  revision chain (no unresolved multiple heads).
- Migrations that reach production are **immutable**. Never edit a migration that
  has already been applied to a shared environment.
- Each migration file must have a clear, descriptive docstring explaining
  **what** it changes and **why**.

---

## 2. Merge Migrations

Merge migrations resolve divergent Alembic heads that arise when two branches
are developed in parallel.

### When They Are Acceptable

- Two or more feature branches each added a migration off the same parent, and
  both have been merged into the main branch.
- Alembic reports multiple heads (`alembic heads` shows > 1 result).

### Requirements

- The `upgrade()` and `downgrade()` functions **must** contain only `pass`.
  A merge migration must **never** include schema changes.
- The module docstring **must** clearly state:
  1. That it is a merge-only migration with no schema changes.
  2. Which two (or more) revisions are being merged and what they represent.
- Reference the Alembic merge documentation:
  https://alembic.sqlalchemy.org/en/latest/branches.html#merging-branches

### How to Create

```bash
cd api/migrations
alembic merge -m "Merge <branch_a_description> with <branch_b_description>" <rev_a> <rev_b>
```

After creation, manually add the explanatory docstring described above.

---

## 3. Backup Migrations

Backup migrations live in `alembic/backup/` and are **archival only**.

### Policy

- Files in `backup/` are **never executed** by Alembic.
- They exist solely to preserve historical context about past schema decisions.
- **Schema reproducibility** must always come from the canonical chain in
  `alembic/versions/`. Backup files must not be relied upon for this purpose.
- When archiving a migration, prefix the filename with the archive date
  (`YYYY-MM-DD__<original_filename>.py`).

### When to Archive

- A migration is superseded by a squashed/consolidated version.
- A migration was created in error and reverted before reaching production.
- Migration history is rewritten after a merge + squash cycle.

---

## 4. New Migration Checklist

Before merging any PR that adds a migration, verify:

- [ ] **Non-empty operations**: `upgrade()` and `downgrade()` contain actual
      schema operations, **or** the migration is a clearly documented merge
      migration (see §2).
- [ ] **Reversibility**: `downgrade()` fully reverses everything `upgrade()`
      does. Test both directions locally.
- [ ] **Docstring**: The module docstring explains what the migration does and
      why it is needed.
- [ ] **Single head**: After applying, `alembic heads` returns exactly one
      revision.
- [ ] **No conflicts**: `alembic upgrade head` succeeds from a clean baseline
      and from the previous head.
- [ ] **Idempotency considered**: If the migration creates tables/indexes, guard
      against `already exists` errors where appropriate (e.g., `if_not_exists`
      flag or `op.execute` with existence checks).
- [ ] **No hardcoded environment values**: Connection strings, secrets, and
      environment-specific values must come from environment variables or
      `alembic.ini`, never from migration source code.

---

## 5. CI Checks for Migration Health

The following checks can be added to CI to enforce migration hygiene
automatically.

### 5.1 Single-Head Check

Fail the build if Alembic detects multiple heads.

```bash
heads=$(cd api/migrations && alembic heads 2>/dev/null | wc -l)
if [ "$heads" -gt 1 ]; then
  echo "ERROR: Multiple Alembic heads detected. Create a merge migration."
  exit 1
fi
```

### 5.2 Empty-Body Detection

Flag migrations with empty `upgrade()`/`downgrade()` that are **not** merge
migrations (i.e., `down_revision` is not a tuple).

```python
#!/usr/bin/env python3
"""CI script: detect non-merge migrations with empty upgrade/downgrade."""
import ast
import sys
from pathlib import Path

VERSIONS_DIR = Path("api/migrations/alembic/versions")
errors = []

for path in VERSIONS_DIR.glob("*.py"):
    source = path.read_text()
    tree = ast.parse(source)

    # Check if this is a merge migration (down_revision is a tuple)
    is_merge = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "down_revision":
                    if isinstance(node.value, ast.Tuple):
                        is_merge = True

    if is_merge:
        continue  # Merge migrations are allowed to have pass-only bodies

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name in ("upgrade", "downgrade"):
            body = node.body
            is_empty = (
                len(body) == 1
                and isinstance(body[0], (ast.Pass, ast.Expr))
                and (
                    isinstance(body[0], ast.Pass)
                    or (isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant))
                )
            )
            if is_empty:
                errors.append(f"{path.name}: {node.name}() is empty but this is not a merge migration")

if errors:
    print("ERROR: Non-merge migrations with empty bodies found:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("OK: All migrations have non-empty bodies or are valid merge migrations.")
```

### 5.3 Downgrade Parity Check

Ensure every migration that creates a table in `upgrade()` drops it in
`downgrade()`, and vice versa.

```bash
for f in api/migrations/alembic/versions/*.py; do
  up_tables=$(grep -c 'op.create_table' "$f" 2>/dev/null || echo 0)
  down_tables=$(grep -c 'op.drop_table' "$f" 2>/dev/null || echo 0)
  if [ "$up_tables" != "$down_tables" ]; then
    echo "WARNING: $f has $up_tables create_table but $down_tables drop_table"
  fi
done
```

### 5.4 Backup Directory Guard

Ensure no files in `backup/` are referenced by the active revision chain.

```bash
if grep -r "backup/" api/migrations/alembic/versions/ 2>/dev/null; then
  echo "ERROR: Active migrations must not reference backup files."
  exit 1
fi
```

---

## 6. Makefile Targets (Recommended)

Add these targets to the project `Makefile` for convenience:

```makefile
migration-check:  ## Verify single Alembic head
	@cd api/migrations && alembic heads | wc -l | xargs test 1 -eq

migration-lint:   ## Lint migration files for empty bodies
	@python scripts/lint_migrations.py

migration-new:    ## Create a new migration (usage: make migration-new MSG="description")
	@cd api/migrations && alembic revision --autogenerate -m "$(MSG)"
```
