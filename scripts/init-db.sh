#!/bin/bash
# ============================================================================
# Database Initialization Script
# Runs automatically when PostgreSQL container first starts
# ============================================================================

set -e

echo "🔧 Initializing GRIME database..."

# Create extensions if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Enable PostGIS if needed for location data
    -- CREATE EXTENSION IF NOT EXISTS postgis;
    
    -- Enable pg_trgm for text search
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOSQL

echo "✅ Database initialization complete!"
