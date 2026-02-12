
#!/bin/bash
# Run Gunicorn with the custom configuration
# Ensure you are in the project root directory

echo "Starting EagleChair API with Gunicorn..."
echo "Workers: 2"
echo "Worker Class: backend.core.worker.AsyncioUvicornWorker (Forces asyncio loop)"
echo "Config: backend/gunicorn_conf.py"

# Add project root to PYTHONPATH to ensure imports work correctly
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Run gunicorn
exec gunicorn -c backend/gunicorn_conf.py backend.main:app
