# ==============================================================================
# NIT Raipur Room Allocation System - Multi-Stage Production Dockerfile
# Serves both Frontend (React SPA) and Backend (Node/Express API + WebSockets)
# on the SAME UNIFIED PORT (Default: 3000).
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Client Build (React + Vite)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Install client dependencies using clean install
COPY client/package*.json ./
RUN npm ci

# Copy client source code
COPY client/ ./

# Build arguments for frontend configuration (empty VITE_API_URL uses same-origin)
ARG VITE_API_URL=""
ARG VITE_MAX_BOOKING_DAYS_ADVANCE=14
ARG VITE_LOCK_EXPIRY_SECONDS=300
ARG VITE_DEPARTMENTS="Computer Science & Engineering,Information Technology,Electronics & Communication,Electrical Engineering,Mechanical Engineering,Civil Engineering,Chemical Engineering,Biotechnology,Metallurgical & Materials,Mining Engineering,Common / Institute Level"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAX_BOOKING_DAYS_ADVANCE=$VITE_MAX_BOOKING_DAYS_ADVANCE
ENV VITE_LOCK_EXPIRY_SECONDS=$VITE_LOCK_EXPIRY_SECONDS
ENV VITE_DEPARTMENTS=$VITE_DEPARTMENTS

# Build production bundle -> /app/client/dist
RUN npm run build

# ------------------------------------------------------------------------------
# STAGE 2: Server Dependencies (Production Only)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS server-builder

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# STAGE 3: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install curl for healthcheck probes and dumb-init for PID 1 signal forwarding
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV CLIENT_DIST_PATH=/app/client/dist

# Copy compiled frontend assets from Stage 1 with correct unprivileged ownership
COPY --chown=node:node --from=client-builder /app/client/dist /app/client/dist

# Copy production node_modules from Stage 2 with correct unprivileged ownership
COPY --chown=node:node --from=server-builder /app/server/node_modules /app/server/node_modules

# Copy server application source code with correct unprivileged ownership
COPY --chown=node:node server/ /app/server/

# Switch to unprivileged user for enterprise security compliance
USER node

WORKDIR /app/server

# Expose unified application port
EXPOSE 3000

# Docker Healthcheck on unified health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

# Forward UNIX signals (SIGTERM/SIGINT) cleanly for zero-downtime graceful shutdowns
ENTRYPOINT ["dumb-init", "--"]

# Launch the unified server
CMD ["node", "src/index.js"]
