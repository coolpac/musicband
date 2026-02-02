#!/usr/bin/env bash
set -euo pipefail

# Remote deploy runner (from local machine)
# Usage:
#   ./scripts/remote-deploy.sh            # full deploy
#   ./scripts/remote-deploy.sh --backend  # only backend
#   ./scripts/remote-deploy.sh --frontend # only frontend
#   ./scripts/remote-deploy.sh --migrate  # only migrations
#   ./scripts/remote-deploy.sh --rollback # rollback
#
# Config via env:
#   REMOTE_HOST (default: 89.223.64.110)
#   REMOTE_USER (default: root)
#   REMOTE_PORT (default: 22)
#   REMOTE_PATH (default: /opt/musicians)
#   SSH_KEY     (optional, path to private key)

if ! command -v ssh >/dev/null 2>&1; then
  echo "Error: ssh is not installed" >&2
  exit 1
fi

REMOTE_HOST="${REMOTE_HOST:-89.223.64.110}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_PATH="${REMOTE_PATH:-/opt/musicians}"
SSH_KEY="${SSH_KEY:-}"

SSH_CMD=(ssh -p "$REMOTE_PORT")
if [[ -n "$SSH_KEY" ]]; then
  SSH_CMD+=(-i "$SSH_KEY")
fi
SSH_CMD+=("${REMOTE_USER}@${REMOTE_HOST}")

REMOTE_PATH_ESC="${REMOTE_PATH//\'/\'\\\'\'}"

REMOTE_ARGS=()
for arg in "$@"; do
  REMOTE_ARGS+=("$(printf '%q' "$arg")")
done
REMOTE_ARGS_STR="${REMOTE_ARGS[*]}"

REMOTE_CMD="set -e; \
if [ ! -d '$REMOTE_PATH_ESC/.git' ]; then \
  echo 'Remote repo not found at $REMOTE_PATH_ESC' >&2; \
  exit 1; \
fi; \
cd '$REMOTE_PATH_ESC'; \
chmod +x deploy.sh; \
./deploy.sh $REMOTE_ARGS_STR"

"${SSH_CMD[@]}" "$REMOTE_CMD"
