#!/usr/bin/env bash
# ==============================================================================
# One-Click Update Script for Car Damage Detection Backend (VPS / Server)
# ==============================================================================
# Usage:
#   ./update.sh
#
# What it does:
#   1. Resolves repository root directory.
#   2. Backs up existing backend/.env (preserves your secret API keys).
#   3. Fetches latest commits from GitHub and resets working tree.
#   4. Restores your backend/.env.
#   5. Rebuilds and launches the Docker inference container on port 7000.
#   6. Runs an automated healthcheck against http://localhost:7000/health.
# ==============================================================================

set -euo pipefail

# Visual color formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}   Car Damage Detection Backend - One-Click Update Script            ${NC}"
echo -e "${GREEN}====================================================================${NC}"

# 1. Determine repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  if [[ -d "$SCRIPT_DIR/../.git" ]]; then
    ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  else
    error "Could not locate .git directory. Please run this script from inside the repository."
  fi
fi

cd "$ROOT_DIR"
info "Working directory: $ROOT_DIR"

# 2. Check prerequisites
command -v git >/dev/null 2>&1 || error "Git is not installed on this system."
command -v docker >/dev/null 2>&1 || error "Docker is not installed on this system."

DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
  else
    error "Neither 'docker compose' nor 'docker-compose' is installed."
  fi
fi

# 3. Detect active git branch (default to main)
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
if [[ "$CURRENT_BRANCH" == "HEAD" || -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="main"
fi
info "Target branch: $CURRENT_BRANCH"

# 4. Safely backup .env files (do NOT overwrite production API keys!)
TEMP_ENV_BACKUP=""
if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  TEMP_ENV_BACKUP="$(mktemp)"
  cp "$ROOT_DIR/backend/.env" "$TEMP_ENV_BACKUP"
  info "Backed up backend/.env securely to temporary storage."
fi

# 5. Fetch from remote and clean local untracked changes
info "Fetching latest code from remote repository..."
git fetch origin "$CURRENT_BRANCH" || error "Failed to fetch from GitHub. Ensure the repo is accessible."

info "Discarding local uncommitted modifications and resetting to origin/$CURRENT_BRANCH..."
git reset --hard "origin/$CURRENT_BRANCH"

# Clean any untracked residue while keeping .env files intact
git clean -fd -e backend/.env -e .env

# Restore preserved .env
if [[ -n "$TEMP_ENV_BACKUP" && -f "$TEMP_ENV_BACKUP" ]]; then
  cp "$TEMP_ENV_BACKUP" "$ROOT_DIR/backend/.env"
  rm -f "$TEMP_ENV_BACKUP"
  ok "Restored production backend/.env."
fi

LATEST_COMMIT="$(git log -1 --pretty=format:'%h - %s (%cr)')"
ok "Repository updated to: $LATEST_COMMIT"

# 6. Rebuild and restart Docker containers
cd "$ROOT_DIR/backend"
info "Rebuilding and restarting inference container..."

$DOCKER_COMPOSE build --pull
$DOCKER_COMPOSE up -d

ok "Docker container updated and started."

# 7. Automated health verification
info "Verifying backend health on port 7000..."
MAX_ATTEMPTS=15
HEALTH_URL="http://localhost:7000/health"
IS_HEALTHY=0

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  if curl -s -f "$HEALTH_URL" >/dev/null 2>&1; then
    IS_HEALTHY=1
    break
  fi
  sleep 2
done

if [[ "$IS_HEALTHY" -eq 1 ]]; then
  HEALTH_RESP="$(curl -s "$HEALTH_URL")"
  echo ""
  echo -e "${GREEN}====================================================================${NC}"
  echo -e "${GREEN}   UPDATE SUCCESSFUL! Backend is Healthy & Operational              ${NC}"
  echo -e "${GREEN}====================================================================${NC}"
  ok "Health status: $HEALTH_RESP"
  ok "Deployed commit: $LATEST_COMMIT"
  echo ""
else
  warn "Health check did not respond within 30 seconds."
  warn "Recent container logs:"
  $DOCKER_COMPOSE logs --tail 30
  error "Backend did not become healthy. Check the logs above."
fi
