# ============================================================================
# Multi-Stage Dockerfile for Data Hygiene Toolkit Backend
# Python 3.13 + FastAPI + Gunicorn
# Targets: base -> development -> production
# Uses pyproject.toml with uv package manager
# ============================================================================

# ============================================================================
# Stage 1: Base - Common dependencies and setup
# ============================================================================
FROM python:3.13-slim AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (modern Python package manager)
RUN pip install --no-cache-dir uv

# Copy pyproject.toml and uv.lock
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv pip install --system --no-cache .

# Set Python environment variables
ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ============================================================================
# Stage 2: Development - Hot reload, debug tools
# ============================================================================
FROM base AS development

# Development dependencies are already in pyproject.toml
# No additional installation needed

# Create app directory
RUN mkdir -p /app/app /app/data /app/migrations

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Development command (will be overridden by docker-compose for volume mount)
CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000", "--log-level", "debug"]

# ============================================================================
# Stage 3: Production - Optimized, secure, no hot reload
# ============================================================================
FROM base AS production

# Copy application code
COPY api/app ./app
COPY api/migrations ./migrations

# Install gunicorn for production server
RUN uv pip install --system --no-cache gunicorn

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app/data

# Switch to non-root user
USER appuser

# Optimize Python bytecode
ENV PYTHONOPTIMIZE=2

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Production command with gunicorn + uvicorn workers
# Using 2 workers for 512Mi memory constraint
CMD ["gunicorn", "app.main:app", \
     "--workers", "2", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
