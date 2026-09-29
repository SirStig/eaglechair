import os

from backend.core.config import settings

# Gunicorn setup
bind = f"{settings.HOST}:{settings.PORT}"
workers = 2
worker_class = "backend.core.worker.AsyncioUvicornWorker"

# Trust X-Forwarded-For only from the reverse proxy. The uvicorn worker takes
# this from gunicorn's setting; rate limiting keys on the resulting client IP.
forwarded_allow_ips = settings.FORWARDED_ALLOW_IPS

# Timeout and Keepalive
timeout = 120
keepalive = 5

# Recycle workers periodically so per-process state (in-memory rate limiter
# history, caches) can't grow without bound
max_requests = 1000
max_requests_jitter = 100

# Security / Performance
preload_app = True
reload = False

# Logging
loglevel = settings.LOG_LEVEL.lower()
accesslog = "-"  # stdout
errorlog = "-"  # stderr

# Set environment
raw_env = [
    f"MODE={os.getenv('MODE', 'production')}",
]
