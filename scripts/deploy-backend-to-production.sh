#!/bin/bash

set -e

SSH_USER="dh_wmujeb"
SSH_HOST="vps27940.dreamhostps.com"
SSH_PORT="22"
LOCAL_BACKEND_PATH="$(cd "$(dirname "$0")/.." && pwd)/backend"
REMOTE_BACKEND_PATH="/home/dh_wmujeb/api.eaglechair.com/backend"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

backup_production_files() {
    log_info "Backing up production files..."
    ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "bash -s" << 'REMOTE_EOF'
        cd /home/dh_wmujeb/api.eaglechair.com/backend
        BACKUP_DIR="deployment_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        rsync -a --exclude='deployment_backup_*' --exclude='__pycache__' --exclude='*.pyc' . "$BACKUP_DIR/" || true
        echo "Backup created in: $BACKUP_DIR"
        ls -dt deployment_backup_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
REMOTE_EOF
    log_success "Production files backed up"
}

deploy() {
    log_info "Starting deployment to $SSH_USER@$SSH_HOST:$SSH_PORT"

    if [ ! -d "$LOCAL_BACKEND_PATH" ]; then
        log_error "Local backend directory not found: $LOCAL_BACKEND_PATH"
        exit 1
    fi

    backup_production_files

    log_info "Syncing backend files (only changed files)..."
    rsync -avz \
        -e "ssh -p $SSH_PORT" \
        --delete \
        --exclude='uploads/' \
        --exclude='alembic/versions/' \
        --exclude='logs/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='*.pyo' \
        --exclude='*.pyd' \
        --exclude='.env' \
        --exclude='.env.*' \
        --exclude='venv/' \
        --exclude='.venv/' \
        --exclude='.git/' \
        --exclude='.gitignore' \
        --exclude='temp_uploads/' \
        --exclude='data/' \
        --exclude='*.log' \
        --exclude='*.pid' \
        --exclude='celerybeat-schedule*' \
        --exclude='deployment_backup_*' \
        --exclude='.DS_Store' \
        --exclude='Thumbs.db' \
        --exclude='*.swp' \
        --exclude='*.swo' \
        --exclude='*.bak' \
        --exclude='.pytest_cache/' \
        --exclude='.coverage' \
        --exclude='htmlcov/' \
        --exclude='*.egg-info/' \
        --exclude='node_modules/' \
        --progress \
        "$LOCAL_BACKEND_PATH/" \
        "$SSH_USER@$SSH_HOST:$REMOTE_BACKEND_PATH/"

    log_success "Files synced successfully"

    log_info "Verifying deployment..."
    ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "bash -s" << 'REMOTE_EOF'
        cd /home/dh_wmujeb/api.eaglechair.com/backend
        echo "=== Deployment Verification ==="
        echo "Critical files check:"
        [ -f "main.py" ] && echo "  main.py found" || echo "  main.py missing"
        [ -f "requirements.txt" ] && echo "  requirements.txt found" || echo "  requirements.txt missing"
        [ -d "api" ] && echo "  api/ found" || echo "  api/ missing"
        [ -d "core" ] && echo "  core/ found" || echo "  core/ missing"
        echo ""
        echo "Directory structure (top level):"
        ls -la | head -15
        echo "=== End Verification ==="
REMOTE_EOF

    log_success "Deployment completed!"
}

usage() {
    echo "Usage: $0 [deploy]"
    echo ""
    echo "Commands:"
    echo "  deploy   - Backup production, then sync backend to $SSH_USER@$SSH_HOST (only changed files)"
}

case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    *)
        usage
        exit 1
        ;;
esac
