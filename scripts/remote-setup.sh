#!/usr/bin/env bash
set -euo pipefail

# Remote server initial setup (clone repository)
# Usage:
#   ./scripts/remote-setup.sh <repository-url>
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

if [ $# -eq 0 ]; then
  echo "Usage: $0 <repository-url>" >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  $0 git@github.com:username/musicians.git" >&2
  echo "  $0 https://github.com/username/musicians.git" >&2
  exit 1
fi

REPO_URL="$1"
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
REPO_URL_ESC="${REPO_URL//\'/\'\\\'\'}"

echo "========================================="
echo "  Remote Server Setup"
echo "========================================="
echo "Server:     ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo "Path:       ${REMOTE_PATH}"
echo "Repository: ${REPO_URL}"
echo ""

REMOTE_CMD="set -e; \
echo '==> Updating system...'; \
apt-get update -qq && apt-get install -y git curl wget; \
echo ''; \
echo '==> Creating directory...'; \
mkdir -p '$(dirname "$REMOTE_PATH_ESC")'; \
if [ -d '$REMOTE_PATH_ESC' ]; then \
  echo 'Error: Directory $REMOTE_PATH_ESC already exists!' >&2; \
  echo 'Remove it first or use a different path.' >&2; \
  exit 1; \
fi; \
echo ''; \
echo '==> Cloning repository...'; \
cd '$(dirname "$REMOTE_PATH_ESC")'; \
git clone '$REPO_URL_ESC' '$(basename "$REMOTE_PATH_ESC")'; \
echo ''; \
echo '==> Making scripts executable...'; \
cd '$REMOTE_PATH_ESC'; \
chmod +x init.sh deploy.sh scripts/*.sh 2>/dev/null || true; \
echo ''; \
echo '✅ Repository cloned successfully!'; \
echo ''; \
echo 'Next steps:'; \
echo '  1. Configure .env file on the server'; \
echo '  2. Run: ./scripts/remote-init.sh'; \
echo ''"

"${SSH_CMD[@]}" "$REMOTE_CMD"

echo ""
echo "========================================="
echo "  ✅ Setup completed!"
echo "========================================="
echo ""
echo "Next step: Configure .env and run first deployment"
echo ""
echo "Option 1: SSH to server and configure manually:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST}"
echo "  cd ${REMOTE_PATH}"
echo "  cp .env.example .env"
echo "  nano .env  # Edit configuration"
echo "  ./init.sh"
echo ""
echo "Option 2: Use remote-init.sh (requires .env to be configured first):"
echo "  REMOTE_HOST=${REMOTE_HOST} ./scripts/remote-init.sh"
echo ""
