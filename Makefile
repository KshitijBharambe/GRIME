# ============================================================================
# Data Hygiene Toolkit - Makefile
# Production-Grade Development & Deployment
# ============================================================================

.PHONY: help
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

# Docker Compose files
COMPOSE := docker compose -f docker/compose/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f docker/compose/docker-compose.dev.yml
COMPOSE_PROD_SIM := $(COMPOSE) -f docker/compose/docker-compose.prod-sim.yml

# Enable Docker BuildKit
export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

##@ General

help: ## Display this help message
	@echo "$(BLUE)Data Hygiene Toolkit - Development Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(GREEN)%-25s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Local Development

dev: ## Start local development environment (hot reload)
	@echo "$(GREEN)Starting local development environment...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env from .env.example$(NC)"; \
		cp .env.example .env; \
	fi
	@$(COMPOSE_DEV) up -d
	@echo "$(GREEN)✓ Development environment started$(NC)"
	@echo ""
	@echo "$(BLUE)Services available at:$(NC)"
	@echo "  Frontend:      http://localhost:3000"
	@echo "  API:           http://localhost:8000"
	@echo "  API Docs:      http://localhost:8000/docs"
	@echo "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
	@echo "  PostgreSQL:    localhost:5432 (admin/devpassword)"
	@echo ""
	@echo "$(YELLOW)Run 'make logs' to view logs$(NC)"

stop: ## Stop all containers
	@echo "$(YELLOW)Stopping containers...$(NC)"
	@$(COMPOSE_DEV) down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

restart: ## Restart all containers
	@echo "$(YELLOW)Restarting containers...$(NC)"
	@$(COMPOSE_DEV) restart
	@echo "$(GREEN)✓ Containers restarted$(NC)"

logs: ## Tail logs from all containers
	@$(COMPOSE_DEV) logs -f

logs-api: ## Tail API logs only
	@$(COMPOSE_DEV) logs -f backend

logs-frontend: ## Tail frontend logs only
	@$(COMPOSE_DEV) logs -f frontend

logs-db: ## Tail database logs only
	@$(COMPOSE_DEV) logs -f postgres

##@ Production Simulation

prod-sim: prod-sim-build prod-sim-up ## Build and start production simulation

prod-sim-build: ## Build production simulation containers
	@echo "$(GREEN)Building production containers...$(NC)"
	@if [ ! -f .env.prod-sim ]; then \
		echo "$(YELLOW)Creating .env.prod-sim from .env.prod-sim.example$(NC)"; \
		cp .env.prod-sim.example .env.prod-sim; \
	fi
	@$(COMPOSE_PROD_SIM) build --parallel
	@echo "$(GREEN)✓ Build complete$(NC)"

prod-sim-up: ## Start production simulation
	@echo "$(GREEN)Starting production simulation...$(NC)"
	@$(COMPOSE_PROD_SIM) up -d
	@echo "$(GREEN)✓ Production simulation started$(NC)"
	@echo ""
	@echo "$(BLUE)Services available at:$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  API:      http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "$(YELLOW)Run 'make prod-sim-logs' to view logs$(NC)"
	@echo "$(YELLOW)Run 'make health-check' to verify services$(NC)"

prod-sim-down: ## Stop production simulation
	@echo "$(YELLOW)Stopping production simulation...$(NC)"
	@$(COMPOSE_PROD_SIM) down
	@echo "$(GREEN)✓ Production simulation stopped$(NC)"

prod-sim-restart: ## Restart production simulation
	@$(COMPOSE_PROD_SIM) restart
	@echo "$(GREEN)✓ Production simulation restarted$(NC)"

prod-sim-logs: ## View production simulation logs
	@$(COMPOSE_PROD_SIM) logs -f

prod-sim-clean: ## Clean production simulation (remove volumes)
	@echo "$(RED)This will remove all volumes and data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(COMPOSE_PROD_SIM) down -v; \
		echo "$(GREEN)✓ Production simulation cleaned$(NC)"; \
	else \
		echo "$(YELLOW)Cleanup cancelled$(NC)"; \
	fi

rebuild: prod-sim-clean prod-sim ## Full rebuild of production simulation

##@ Database Operations

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	@$(COMPOSE_DEV) exec backend alembic upgrade head
	@echo "$(GREEN)✓ Migrations complete$(NC)"

db-migrate-create: ## Create new migration (usage: make db-migrate-create MSG="description")
	@if [ -z "$(MSG)" ]; then \
		echo "$(RED)Error: MSG required$(NC)"; \
		echo "Usage: make db-migrate-create MSG=\"your migration description\""; \
		exit 1; \
	fi
	@echo "$(GREEN)Creating migration: $(MSG)$(NC)"
	@$(COMPOSE_DEV) exec backend alembic revision --autogenerate -m "$(MSG)"

db-shell: ## Open PostgreSQL shell
	@echo "$(GREEN)Opening PostgreSQL shell...$(NC)"
	@$(COMPOSE_DEV) exec postgres psql -U admin -d data_hygiene

db-backup: ## Backup database to ./backups/
	@mkdir -p backups
	@echo "$(GREEN)Backing up database...$(NC)"
	@$(COMPOSE_DEV) exec -T postgres pg_dump -U admin data_hygiene > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up to backups/$(NC)"

db-restore: ## Restore database from backup (usage: make db-restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE required$(NC)"; \
		echo "Usage: make db-restore FILE=backups/backup_20241019_120000.sql"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring database from $(FILE)...$(NC)"
	@$(COMPOSE_DEV) exec -T postgres psql -U admin data_hygiene < $(FILE)
	@echo "$(GREEN)✓ Database restored$(NC)"

##@ Storage (MinIO)

minio-ui: ## Open MinIO web console
	@echo "$(BLUE)Opening MinIO console at http://localhost:9001$(NC)"
	@echo "Credentials: minioadmin / minioadmin"
	@open http://localhost:9001 || xdg-open http://localhost:9001 || echo "Open http://localhost:9001 manually"

init-buckets: ## Initialize MinIO buckets
	@echo "$(GREEN)Initializing MinIO buckets...$(NC)"
	@$(COMPOSE_DEV) up minio-init
	@echo "$(GREEN)✓ Buckets initialized$(NC)"

##@ Container Access

shell-api: ## Enter backend container shell
	@$(COMPOSE_DEV) exec backend sh

shell-frontend: ## Enter frontend container shell
	@$(COMPOSE_DEV) exec frontend sh

shell-db: ## Enter PostgreSQL container shell
	@$(COMPOSE_DEV) exec postgres sh

##@ Testing

test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	@$(COMPOSE_DEV) exec backend pytest
	@echo "$(GREEN)✓ Tests complete$(NC)"

test-unit: ## Run unit tests only
	@$(COMPOSE_DEV) exec backend pytest tests/unit

test-integration: ## Run integration tests
	@$(COMPOSE_DEV) exec backend pytest tests/integration

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@$(COMPOSE_DEV) exec backend pytest --cov=app --cov-report=html
	@echo "$(GREEN)✓ Coverage report generated in htmlcov/$(NC)"

test-watch: ## Run tests in watch mode
	@$(COMPOSE_DEV) exec backend pytest-watch

##@ Code Quality

lint: ## Run all linters
	@echo "$(GREEN)Running linters...$(NC)"
	@$(COMPOSE_DEV) exec backend black --check app/
	@$(COMPOSE_DEV) exec backend ruff check app/
	@$(COMPOSE_DEV) exec backend mypy app/

format: ## Auto-format code
	@echo "$(GREEN)Formatting code...$(NC)"
	@$(COMPOSE_DEV) exec backend black app/
	@$(COMPOSE_DEV) exec backend ruff check --fix app/
	@$(COMPOSE_DEV) exec backend isort app/
	@echo "$(GREEN)✓ Code formatted$(NC)"

type-check: ## Run type checking
	@$(COMPOSE_DEV) exec backend mypy app/

sonar-scan: ## Run SonarQube analysis
	@echo "$(GREEN)Running SonarQube analysis...$(NC)"
	@./run-sonar-scan.sh

sonar-report: ## Generate SonarQube report with coverage
	@echo "$(GREEN)Generating test coverage for SonarQube...$(NC)"
	@cd api && python -m pytest tests/ --cov=app --cov-report=xml:coverage.xml --cov-report=term -v
	@echo "$(GREEN)✓ Coverage report generated$(NC)"
	@echo ""
	@echo "$(YELLOW)Now run: make sonar-scan$(NC)"

##@ Health & Monitoring

health-check: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@echo "$(BLUE)Backend API:$(NC)"
	@curl -f http://localhost:8000/ && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(RED)✗ Unhealthy$(NC)"
	@echo ""
	@echo "$(BLUE)Frontend:$(NC)"
	@curl -f http://localhost:3000/ && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(RED)✗ Unhealthy$(NC)"
	@echo ""
	@echo "$(BLUE)MinIO:$(NC)"
	@curl -f http://localhost:9000/minio/health/live && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(RED)✗ Unhealthy$(NC)"
	@echo ""
	@echo "$(BLUE)PostgreSQL:$(NC)"
	@$(COMPOSE_DEV) exec postgres pg_isready -U admin && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(RED)✗ Unhealthy$(NC)"

status: ## Show container status
	@$(COMPOSE_DEV) ps

docker-stats: ## Show Docker resource usage
	@docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "(dht-|CONTAINER)"

##@ Cleanup

clean: ## Stop and remove all containers
	@echo "$(YELLOW)Cleaning up...$(NC)"
	@$(COMPOSE_DEV) down
	@$(COMPOSE_PROD_SIM) down
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-volumes: ## Remove all volumes (WARNING: deletes data!)
	@echo "$(RED)This will remove ALL DATA!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(COMPOSE_DEV) down -v; \
		$(COMPOSE_PROD_SIM) down -v; \
		echo "$(GREEN)✓ Volumes removed$(NC)"; \
	else \
		echo "$(YELLOW)Cleanup cancelled$(NC)"; \
	fi

clean-docker: ## Remove dangling images and containers
	@echo "$(YELLOW)Cleaning Docker resources...$(NC)"
	@docker container prune -f
	@docker image prune -f
	@echo "$(GREEN)✓ Docker cleaned$(NC)"

clean-all: clean clean-volumes clean-docker ## Nuclear option: clean everything

##@ Setup & Installation

setup: ## First-time project setup
	@echo "$(GREEN)Setting up Data Hygiene Toolkit...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env$(NC)"; \
	fi
	@if [ ! -f .env.prod-sim ]; then \
		cp .env.prod-sim.example .env.prod-sim; \
		echo "$(GREEN)✓ Created .env.prod-sim$(NC)"; \
	fi
	@chmod +x scripts/*.sh
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo "$(YELLOW)Run 'make dev' to start development$(NC)"

##@ Utility

env-check: ## Verify environment configuration
	@echo "$(BLUE)Checking environment files...$(NC)"
	@if [ -f .env ]; then echo "$(GREEN)✓ .env exists$(NC)"; else echo "$(RED)✗ .env missing$(NC)"; fi
	@if [ -f .env.prod-sim ]; then echo "$(GREEN)✓ .env.prod-sim exists$(NC)"; else echo "$(YELLOW)⚠ .env.prod-sim missing$(NC)"; fi

docker-info: ## Show Docker configuration
	@echo "$(BLUE)Docker Configuration:$(NC)"
	@echo "  BuildKit: ${DOCKER_BUILDKIT}"
	@echo "  Compose CLI Build: ${COMPOSE_DOCKER_CLI_BUILD}"
	@echo ""
	@echo "$(BLUE)Images:$(NC)"
	@docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(dht|REPOSITORY)" || true
