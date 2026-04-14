#!/bin/bash
# ============================================================================
# Wait for Database Readiness
# ============================================================================
#
# Usage: ./scripts/wait-for-db.sh <container_name> <user> <db_name> [timeout]
# ============================================================================

CONTAINER=$1
USER=$2
DB=$3
TIMEOUT=${4:-30}

if [ -z "$CONTAINER" ] || [ -z "$USER" ] || [ -z "$DB" ]; then
    echo "Usage: $0 <container_name> <user> <db_name> [timeout]"
    exit 1
fi

echo "⏳ Waiting for database in container '$CONTAINER' to be ready..."

for i in $(seq 1 $TIMEOUT); do
    if docker exec "$CONTAINER" pg_isready -U "$USER" -d "$DB" > /dev/null 2>&1; then
        echo "✅ Database is ready!"
        exit 0
    fi
    echo "  (Attempt $i/$TIMEOUT - waiting...)"
    sleep 1
done

echo "❌ Error: Database did not become ready within $TIMEOUT seconds."
exit 1
