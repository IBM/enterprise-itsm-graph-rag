# ─────────────────────────────────────────────────────────────────────────────
# Enterprise ITSM Graph RAG Demo — Single Container
# Combines FastAPI backend + Carbon React frontend in one Docker image
#
# Architecture inside the container:
#   - nginx (port 9000): serves React static files + proxies /api/* → uvicorn
#   - uvicorn (port 8000, internal): FastAPI backend
#   - supervisord: manages both processes
#
# Base image: UBI 9 Python 3.12 (Red Hat Universal Base Image)
#
# Usage:
#   docker build -t enterprise-itsm-graph-rag .
#   docker run -p 9000:9000 --env-file .env enterprise-itsm-graph-rag
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────
# Stage 1: Build React frontend (node:20-alpine)
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for better layer caching
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm install --silent

# Copy source code
COPY frontend/ .

# Build with API URL pointing to nginx proxy path
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: UBI Python 3.12 — backend + nginx + supervisord
# ─────────────────────────────────────────────
FROM registry.access.redhat.com/ubi9/python-312:latest

# Switch to root to install system packages
USER root

# Install nginx via dnf (UBI9 AppStream repo)
# Install supervisor via pip (not available in UBI9 repos)
RUN dnf install -y nginx && \
    dnf clean all && \
    pip install --no-cache-dir supervisor

# ── Backend setup ──
WORKDIR /app/backend

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ .

# ── Frontend static files ──
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# ── nginx configuration ──
# nginx listens on 9000, serves React, proxies /api/* to uvicorn on 8000
COPY nginx-combined.conf /etc/nginx/conf.d/default.conf
# Remove default nginx site config to avoid conflicts
RUN rm -f /etc/nginx/sites-enabled/default && \
    # Ensure nginx html dir is readable
    chmod -R 755 /usr/share/nginx/html && \
    # Create nginx pid/log dirs with correct permissions
    mkdir -p /var/run/nginx /var/log/nginx /var/lib/nginx/tmp && \
    chmod -R 777 /var/run/nginx /var/log/nginx /var/lib/nginx/tmp

# ── supervisord configuration ──
# Create config dir (pip-installed supervisor doesn't create /etc/supervisor/)
RUN mkdir -p /etc/supervisor/conf.d
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Expose single port ──
EXPOSE 9000

# ── Health check ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9000/api/health || exit 1

# ── Start supervisord (manages both nginx and uvicorn) ──
# In UBI9, pip installs to /opt/app-root/bin/
CMD ["/opt/app-root/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]