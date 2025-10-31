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
  --forwarded-allow-ips='*' \
  --log-level info \
  --no-access-log \
  --timeout-keep-alive 300 \
  --limit-max-requests 0
