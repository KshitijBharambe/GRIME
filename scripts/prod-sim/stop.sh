#!/bin/bash

# ============================================================================
# Production Simulation - Stop Script
# ============================================================================
# This script stops the production simulation environment
#
# Usage: ./scripts/prod-sim/stop.sh [--clean]
#   --clean: Also remove volumes (WARNING: deletes all data)
# ============================================================================

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker/compose/docker-compose.prod-sim.yml"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")

cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Production Simulation - Stop${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if --clean flag is provided
CLEAN_MODE=false
if [ "$1" == "--clean" ]; then
    CLEAN_MODE=true
    echo -e "${RED}⚠ CLEAN MODE ENABLED${NC}"
    echo -e "${RED}This will remove all volumes and delete all data!${NC}"
    echo ""
    read -p "Are you sure you want to continue? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Cancelled${NC}"
        exit 0
    fi
    echo ""
fi

# Check if containers are running
if ! docker ps | grep -q "prodsim-"; then
    echo -e "${YELLOW}⚠ No production simulation containers are running${NC}"
    exit 0
fi

# Stop containers
echo -e "${BLUE}Stopping production simulation containers...${NC}"

if [ "$CLEAN_MODE" = true ]; then
    "${COMPOSE_CMD[@]}" down -v
    echo -e "${GREEN}✓ Containers stopped and volumes removed${NC}"
else
    "${COMPOSE_CMD[@]}" down
    echo -e "${GREEN}✓ Containers stopped (volumes preserved)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Production Simulation Stopped${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$CLEAN_MODE" = true ]; then
    echo -e "${YELLOW}All data has been removed.${NC}"
    echo "To start fresh:"
    echo "  make prod-sim"
    echo "  or"
    echo "  ./scripts/prod-sim/start.sh"
else
    echo -e "${BLUE}Data volumes are preserved.${NC}"
    echo "To start again:"
    echo "  make prod-sim-up"
    echo ""
    echo "To clean all data:"
    echo "  make prod-sim-clean"
    echo "  or"
    echo "  ./scripts/prod-sim/stop.sh --clean"
fi

echo ""
