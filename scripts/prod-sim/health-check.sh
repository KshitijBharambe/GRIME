#!/bin/bash

# ============================================================================
# Production Simulation - Health Check Script
# ============================================================================
# This script checks the health status of all services in the prod-sim env
#
# Usage: ./scripts/prod-sim/health-check.sh
#   or:  make health-check
# ============================================================================

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker/compose/docker-compose.prod-sim.yml"

cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Symbols
CHECK_MARK="${GREEN}✓${NC}"
CROSS_MARK="${RED}✗${NC}"
WARNING="${YELLOW}⚠${NC}"

# Counters
TOTAL=0
HEALTHY=0
UNHEALTHY=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Production Simulation - Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local timeout=${3:-5}

    TOTAL=$((TOTAL + 1))

    if curl -f -s -m "$timeout" "$url" > /dev/null 2>&1; then
        echo -e "$CHECK_MARK ${name}: ${GREEN}Healthy${NC}"
        HEALTHY=$((HEALTHY + 1))
        return 0
    else
        echo -e "$CROSS_MARK ${name}: ${RED}Unhealthy${NC}"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

# Function to check docker container
check_container() {
    local name=$1
    local container=$2

    TOTAL=$((TOTAL + 1))

    if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
        # Try to get health status, suppress errors (container may not have healthcheck)
        local health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null)

        if [ "$health" == "healthy" ]; then
            echo -e "$CHECK_MARK ${name}: ${GREEN}Running${NC} (healthy)"
            HEALTHY=$((HEALTHY + 1))
            return 0
        elif [ "$health" == "none" ] || [ -z "$health" ]; then
            # Container doesn't have a healthcheck configured - that's OK if it's running
            echo -e "$CHECK_MARK ${name}: ${GREEN}Running${NC}"
            HEALTHY=$((HEALTHY + 1))
            return 0
        else
            echo -e "$WARNING ${name}: ${YELLOW}Running but unhealthy${NC} (health: $health)"
            UNHEALTHY=$((UNHEALTHY + 1))
            return 1
        fi
    else
        echo -e "$CROSS_MARK ${name}: ${RED}Not running${NC}"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

echo -e "${BLUE}Checking Infrastructure Services...${NC}"
echo "───────────────────────────────────────────────────────────"

# Container names are defined in docker/compose/docker-compose.yml
check_container "PostgreSQL Database" "grime-postgres"
check_container "MinIO Object Storage" "grime-minio"

echo ""
echo -e "${BLUE}Checking Application Services...${NC}"
echo "───────────────────────────────────────────────────────────"

check_container "Backend API" "grime-backend"
check_container "Frontend" "grime-frontend"

echo ""
echo -e "${BLUE}Checking HTTP Endpoints...${NC}"
echo "───────────────────────────────────────────────────────────"

check_http "API Root" "http://localhost:8000/"
check_http "API Health" "http://localhost:8000/health"
check_http "API Docs" "http://localhost:8000/docs"
check_http "Frontend" "http://localhost:3000/"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total Services:   $TOTAL"
echo -e "  ${GREEN}Healthy:${NC}          $HEALTHY"
echo -e "  ${RED}Unhealthy:${NC}        $UNHEALTHY"
echo ""

if [ $UNHEALTHY -eq 0 ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo "  Frontend:         http://localhost:3000"
    echo "  API:              http://localhost:8000"
    echo "  API Docs:         http://localhost:8000/docs"
    echo "  PostgreSQL:       internal only (prod-sim; exposed only in dev)"
    echo "  MinIO:            internal only (prod-sim; console port 9001 in dev)"
    exit 0
else
    echo -e "${YELLOW}⚠ Some services are unhealthy or not running${NC}"
    echo ""
    echo "To view logs for a specific service:"
    echo "  docker compose -f $COMPOSE_FILE logs <service-name>"
    echo ""
    echo "To restart all services:"
    echo "  make prod-sim-restart"
    exit 1
fi
