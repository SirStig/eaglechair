#!/bin/bash
# Production startup script for DreamHost VPS
# This script starts the FastAPI backend with proper proxy header support

# Set environment to production
export ENVIRONMENT=production

# Start uvicorn with proxy headers enabled
# The backend runs on HTTP (port 8000) locally
# The reverse proxy (Apache/Nginx) handles HTTPS termination
python3 -m uvicorn backend.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-*}" \
  --log-level info \
  --no-access-log \
  --timeout-keep-alive 300
# Note: don't pass --limit-max-requests 0 — uvicorn treats 0 as "exit after
# 0 requests" and shuts the server down immediately.
# FORWARDED_ALLOW_IPS: set to the reverse proxy's IP so clients can't spoof
# X-Forwarded-For (rate limiting keys on the client IP).
