#!/bin/bash

# ============================================================================
# Production Simulation - Startup Script
# ============================================================================
# This script handles initialization and startup of the prod-sim environment
#
# Usage: ./scripts/prod-sim/start.sh
# ============================================================================

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker/compose/docker-compose.prod-sim.yml"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Production Simulation - Startup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if .env.prod-sim exists
cd "$REPO_ROOT"

if [ ! -f .env.prod-sim ]; then
    echo -e "${YELLOW}⚠ .env.prod-sim not found${NC}"
    echo ""
    echo -e "${GREEN}Creating from template...${NC}"

    if [ -f .env.prod-sim.example ]; then
        cp .env.prod-sim.example .env.prod-sim
        echo -e "${GREEN}✓ Created .env.prod-sim from .env.prod-sim.example${NC}"
    else
        echo -e "${RED}✗ Error: .env.prod-sim.example not found${NC}"
        echo "Please create .env.prod-sim manually"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}Please configure .env.prod-sim with appropriate values${NC}"
    echo "You can edit it now or press Enter to continue with defaults"
    read -p "Press Enter to continue..."
fi

# Load environment variables
echo -e "${BLUE}Loading environment variables...${NC}"
set -a
source .env.prod-sim
set +a
echo -e "${GREEN}✓ Environment loaded${NC}"
echo ""
# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
echo -e "${YELLOW}Supabase integration removed — skipping Supabase CLI check${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo "Please install Docker Desktop"
    exit 1
else
    echo -e "${GREEN}✓ Docker found${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not available${NC}"
    echo "Please install a Docker version with 'docker compose' support"
    exit 1
else
    echo -e "${GREEN}✓ Docker Compose found${NC}"
fi

echo ""

# Check if containers are already running
if docker ps | grep -q "prodsim-"; then
    echo -e "${YELLOW}⚠ Production simulation containers are already running${NC}"
    echo ""
    read -p "Restart them? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Stopping existing containers...${NC}"
        "${COMPOSE_CMD[@]}" down
        echo -e "${GREEN}✓ Stopped${NC}"
        echo ""
    else
        echo -e "${GREEN}Continuing with existing containers...${NC}"
        echo ""
        ./scripts/prod-sim/health-check.sh
        exit 0
    fi
fi

# Build containers
echo -e "${BLUE}Building containers...${NC}"
echo -e "${YELLOW}This may take a few minutes on first run...${NC}"
"${COMPOSE_CMD[@]}" build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Start containers
echo -e "${BLUE}Starting production simulation environment...${NC}"
"${COMPOSE_CMD[@]}" --env-file .env.prod-sim up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Run migrations
echo -e "${BLUE}Running database migrations...${NC}"
./scripts/wait-for-db.sh grime-postgres admin data_hygiene
"${COMPOSE_CMD[@]}" exec backend alembic -c migrations/alembic.ini upgrade head
echo -e "${GREEN}✓ Migrations complete$(NC)"
echo ""

# Wait for services to be healthy
echo -e "${BLUE}Waiting for services to be healthy...${NC}"
echo -e "${YELLOW}This may take 30-60 seconds...${NC}"
echo ""

sleep 10

# Check health
./scripts/prod-sim/health-check.sh

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Production Simulation Started Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Visit the frontend: http://localhost:3000"
echo "  2. Explore the API docs: http://localhost:8000/docs"
echo "  3. Manage database with Supabase Studio: http://localhost:54323"
echo "  4. Check emails in Inbucket: http://localhost:54324"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  make health-check       - Check service health"
echo "  make prod-sim-logs      - View all logs"
echo "  make logs-api           - View API logs only"
echo "  make logs-frontend      - View frontend logs only"
echo "  make prod-sim-down      - Stop all services"
echo ""
