# ============================================================================
# Multi-Stage Dockerfile for GRIME Frontend
# Node.js 22 LTS + Next.js 15
# Targets: base -> development -> builder -> production
# ============================================================================

# ============================================================================
# Stage 1: Base - Common Node.js setup
# ============================================================================
FROM node:22-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ============================================================================
# Stage 2: Dependencies - Install node_modules
# ============================================================================
FROM base AS deps

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies based on lock file
RUN npm ci

# ============================================================================
# Stage 3: Development - Hot reload with dev server
# ============================================================================
FROM base AS development

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (will be overridden by volume mount in dev)
COPY frontend/ .

# Expose port
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

# Development command (hot reload)
CMD ["npm", "run", "dev"]

# ============================================================================
# Stage 4: Builder - Build production bundle
# ============================================================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY frontend/ .

# Accept build-time arguments for NEXT_PUBLIC_* variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL

# Set as environment variables for the build
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build Next.js application (creates standalone output)
RUN npm run build

# ============================================================================
# Stage 5: Production Runner - Optimized runtime
# ============================================================================
FROM node:22-alpine AS production

WORKDIR /app

# Set to production environment
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME="0.0.0.0" \
    PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output (automatically created by Next.js)
# This includes a minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js server
CMD ["node", "server.js"]
