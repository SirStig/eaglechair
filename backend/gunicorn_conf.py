import os

from backend.core.config import settings

# Gunicorn setup
bind = f"{settings.HOST}:{settings.PORT}"
workers = 2
worker_class = "backend.core.worker.AsyncioUvicornWorker"

# Timeout and Keepalive
timeout = 120
keepalive = 5

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
