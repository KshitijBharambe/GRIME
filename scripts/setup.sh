#!/bin/bash
# ============================================================================
# Setup Script for GRIME
# First-time project setup
# ============================================================================

set -e

echo "🚀 Setting up GRIME..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Create .env files if they don't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi

if [ ! -f .env.prod-sim ]; then
    echo -e "${YELLOW}Creating .env.prod-sim from template...${NC}"
    cp .env.prod-sim.example .env.prod-sim
    echo -e "${GREEN}✓ Created .env.prod-sim${NC}"
else
    echo -e "${GREEN}✓ .env.prod-sim already exists${NC}"
fi

# Make scripts executable
echo -e "${YELLOW}Making scripts executable...${NC}"
chmod +x scripts/*.sh
echo -e "${GREEN}✓ Scripts are executable${NC}"

# Create data directories
echo -e "${YELLOW}Creating data directories...${NC}"
mkdir -p api/data/datasets
mkdir -p api/data/uploads
mkdir -p backups
echo -e "${GREEN}✓ Data directories created${NC}"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review and update .env with your configuration"
echo "  2. Run 'make dev' to start development environment"
echo "  3. Run 'make health-check' to verify all services"
echo ""
echo "Quick start:"
echo "  make dev          # Start development with hot reload"
echo "  make logs         # View logs"
echo "  make db-migrate   # Run database migrations"
echo ""
