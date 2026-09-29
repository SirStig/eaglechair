#!/bin/bash

set -e

SSH_USER="dh_wmujeb"
SSH_HOST="vps27940.dreamhostps.com"
SSH_PORT="22"
LOCAL_FRONTEND_PATH="$(cd "$(dirname "$0")/.." && pwd)/frontend"
LOCAL_DIST_PATH="$LOCAL_FRONTEND_PATH/dist"
REMOTE_FRONTEND_PATH="/home/dh_wmujeb/joshua.eaglechair.com"

# Runtime content on the server that the build must never overwrite or delete.
# rsync excludes also protect these paths from --delete.
#   data/     - CMS export (contentData.json etc.) written by the backend
#   uploads/  - admin uploads (incl. uploads/quotes attachments)
#   quotes/   - quote files
#   tmp/      - virtual catalog / PDF parser temp images and uploads
PROTECTED_PATHS=(
    'data/'
    'uploads/'
    'quotes/'
    'tmp/'
    '.htaccess'
    '.well-known/'
    'deployment_backup_*'
    'logs/'
    '*.log'
)

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

build_frontend() {
    log_info "Building production frontend..."
    (cd "$LOCAL_FRONTEND_PATH" && bash ./build-production.sh)

    if [ ! -f "$LOCAL_DIST_PATH/index.html" ]; then
        log_error "Build output missing: $LOCAL_DIST_PATH/index.html"
        exit 1
    fi
    log_success "Frontend built"
}

backup_production_files() {
    log_info "Backing up production frontend (code only, content folders skipped)..."
    ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "bash -s" << 'REMOTE_EOF'
        cd /home/dh_wmujeb/joshua.eaglechair.com
        BACKUP_DIR="deployment_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        rsync -a \
            --exclude='deployment_backup_*' \
            --exclude='uploads/' \
            --exclude='tmp/' \
            --exclude='quotes/' \
            . "$BACKUP_DIR/" || true
        echo "Backup created in: $BACKUP_DIR"
        ls -dt deployment_backup_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
REMOTE_EOF
    log_success "Production files backed up"
}

sync_files() {
    local dry_run_flag="$1"

    local exclude_args=()
    for path in "${PROTECTED_PATHS[@]}"; do
        exclude_args+=("--exclude=$path")
    done

    rsync -avz $dry_run_flag \
        -e "ssh -p $SSH_PORT" \
        --delete \
        "${exclude_args[@]}" \
        --exclude='.DS_Store' \
        --exclude='Thumbs.db' \
        --progress \
        "$LOCAL_DIST_PATH/" \
        "$SSH_USER@$SSH_HOST:$REMOTE_FRONTEND_PATH/"
}

verify() {
    log_info "Verifying deployment..."
    ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "bash -s" << 'REMOTE_EOF'
        cd /home/dh_wmujeb/joshua.eaglechair.com
        echo "=== Deployment Verification ==="
        [ -f "index.html" ] && echo "  index.html found" || echo "  index.html missing"
        [ -d "assets" ] && echo "  assets/ found" || echo "  assets/ missing"
        [ -f "data/contentData.json" ] && echo "  data/contentData.json preserved" || echo "  data/contentData.json missing"
        echo ""
        echo "Directory structure (top level):"
        ls -la | head -25
        echo "=== End Verification ==="
REMOTE_EOF
}

deploy() {
    local skip_build="$1"

    log_info "Starting frontend deployment to $SSH_USER@$SSH_HOST:$REMOTE_FRONTEND_PATH"

    if [ "$skip_build" != "true" ]; then
        build_frontend
    elif [ ! -f "$LOCAL_DIST_PATH/index.html" ]; then
        log_error "No build found at $LOCAL_DIST_PATH. Run without --skip-build."
        exit 1
    else
        log_warning "Skipping build, deploying existing $LOCAL_DIST_PATH"
    fi

    backup_production_files

    log_info "Syncing frontend build (protected: ${PROTECTED_PATHS[*]})..."
    sync_files ""
    log_success "Files synced successfully"

    verify
    log_success "Deployment completed!"
}

dry_run() {
    local skip_build="$1"
    if [ "$skip_build" != "true" ]; then
        build_frontend
    fi
    log_warning "DRY RUN - nothing will be changed on the server"
    sync_files "--dry-run"
}

usage() {
    echo "Usage: $0 [deploy|dry-run] [--skip-build]"
    echo ""
    echo "Commands:"
    echo "  deploy        - Build, back up production, then sync frontend/dist to $REMOTE_FRONTEND_PATH"
    echo "  dry-run       - Build and show what rsync would change, without changing anything"
    echo ""
    echo "Options:"
    echo "  --skip-build  - Deploy the existing frontend/dist without rebuilding"
    echo ""
    echo "Never touched on the server: ${PROTECTED_PATHS[*]}"
}

SKIP_BUILD="false"
for arg in "$@"; do
    [ "$arg" = "--skip-build" ] && SKIP_BUILD="true"
done

case "${1:-deploy}" in
    "deploy"|"--skip-build")
        deploy "$SKIP_BUILD"
        ;;
    "dry-run")
        dry_run "$SKIP_BUILD"
        ;;
    *)
        usage
        exit 1
        ;;
esac
