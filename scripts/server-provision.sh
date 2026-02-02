#!/usr/bin/env bash
set -euo pipefail

# Complete server provisioning from scratch
# Usage:
#   ./scripts/server-provision.sh <repository-url> [domain]
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
  echo "Usage: $0 <repository-url> [domain]" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  $0 git@github.com:username/musicians.git" >&2
  echo "  $0 https://github.com/username/musicians.git vgulcover.ru" >&2
  exit 1
fi

REPO_URL="$1"
DOMAIN="${2:-}"
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

echo "========================================="
echo "  🚀 Server Provisioning"
echo "========================================="
echo "Server:     ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo "Path:       ${REMOTE_PATH}"
echo "Repository: ${REPO_URL}"
if [[ -n "$DOMAIN" ]]; then
  echo "Domain:     ${DOMAIN}"
fi
echo ""
echo "This will:"
echo "  1. Update system packages"
echo "  2. Install Docker & Docker Compose"
echo "  3. Setup firewall (UFW)"
echo "  4. Clone repository"
echo "  5. Create .env template"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

REMOTE_PATH_ESC="${REMOTE_PATH//\'/\'\\\'\'}"
REPO_URL_ESC="${REPO_URL//\'/\'\\\'\'}"
DOMAIN_ESC="${DOMAIN//\'/\'\\\'\'}"

cat > /tmp/provision.sh <<'PROVISION_SCRIPT'
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[PROVISION]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

REPO_URL="$1"
REMOTE_PATH="$2"
DOMAIN="$3"

log "========================================="
log "  Step 1/6: System Update"
log "========================================="
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y curl wget git ufw ca-certificates gnupg

log ""
log "========================================="
log "  Step 2/6: Docker Installation"
log "========================================="
if command -v docker &>/dev/null; then
  log "Docker already installed: $(docker --version)"
else
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker installed: $(docker --version)"
fi

if docker compose version &>/dev/null; then
  log "Docker Compose already installed: $(docker compose version)"
else
  log "Installing Docker Compose plugin..."
  apt-get update -qq
  apt-get install -y docker-compose-plugin
  log "Docker Compose installed: $(docker compose version)"
fi

log ""
log "========================================="
log "  Step 3/6: Firewall Setup"
log "========================================="
if ! ufw status | grep -q "Status: active"; then
  log "Configuring firewall..."
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  ufw --force enable
  log "Firewall configured and enabled"
else
  log "Firewall already active"
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
fi

log ""
log "========================================="
log "  Step 4/6: Clone Repository"
log "========================================="
mkdir -p "$(dirname "$REMOTE_PATH")"
if [ -d "$REMOTE_PATH" ]; then
  warn "Directory $REMOTE_PATH already exists, skipping clone"
else
  log "Cloning $REPO_URL..."
  cd "$(dirname "$REMOTE_PATH")"
  git clone "$REPO_URL" "$(basename "$REMOTE_PATH")"
  log "Repository cloned successfully"
fi

cd "$REMOTE_PATH"
chmod +x init.sh deploy.sh scripts/*.sh 2>/dev/null || true

log ""
log "========================================="
log "  Step 5/6: Generate Secrets"
log "========================================="
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

log "Generated secure passwords and secrets"

log ""
log "========================================="
log "  Step 6/6: Create .env File"
log "========================================="

if [ -f .env ]; then
  warn ".env already exists, creating .env.generated as example"
  ENV_FILE=".env.generated"
else
  ENV_FILE=".env"
fi

if [ -n "$DOMAIN" ]; then
  FRONTEND_URL="https://$DOMAIN"
else
  FRONTEND_URL="http://$(curl -s ifconfig.me 2>/dev/null || echo '89.223.64.110')"
fi

cat > "$ENV_FILE" <<ENV
# ===================================
# Музыканты — Production Environment
# ===================================
# Auto-generated on $(date)

# --- Database ---
POSTGRES_DB=musicians_db
POSTGRES_USER=musicians
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# --- Redis ---
REDIS_PASSWORD=${REDIS_PASSWORD}

# --- JWT ---
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# --- Telegram Bots ---
# ⚠️  ВАЖНО: Получите токены у @BotFather в Telegram!
TELEGRAM_ADMIN_BOT_TOKEN=CHANGE_ME_GET_FROM_BOTFATHER
TELEGRAM_USER_BOT_TOKEN=CHANGE_ME_GET_FROM_BOTFATHER
TELEGRAM_USER_BOT_USERNAME=YourBotUsername

# --- URLs ---
FRONTEND_URL=${FRONTEND_URL}

# --- Admin (optional) ---
# Сгенерировать: docker run --rm node:20-alpine node -e "const bcrypt=require('bcrypt'); bcrypt.hash('your-password',10).then(console.log)"
ADMIN_PASSWORD_HASH=

# --- Server ---
APP_PORT=80
ENV

log "Created $ENV_FILE"
log ""
log "========================================="
log "  ✅ Provisioning Complete!"
log "========================================="
log ""
warn "⚠️  NEXT STEPS REQUIRED:"
echo ""
echo "1. Edit .env file and add Telegram bot tokens:"
echo "   nano $REMOTE_PATH/$ENV_FILE"
echo ""
echo "   Required fields:"
echo "   - TELEGRAM_ADMIN_BOT_TOKEN (get from @BotFather)"
echo "   - TELEGRAM_USER_BOT_TOKEN (optional)"
echo ""
echo "2. Review and save the file"
echo ""
echo "3. Start the application:"
echo "   cd $REMOTE_PATH"
echo "   ./init.sh"
echo ""
if [ -n "$DOMAIN" ]; then
echo "4. Setup SSL certificate:"
echo "   apt install -y certbot"
echo "   certbot certonly --standalone -d $DOMAIN"
echo "   # Then update docker-compose.yml and nginx config for SSL"
echo ""
fi
echo "Generated credentials (SAVE THESE SECURELY):"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
echo "  REDIS_PASSWORD:    ${REDIS_PASSWORD}"
echo "  JWT_SECRET:        ${JWT_SECRET}"
echo ""
log "Server is ready for deployment!"
PROVISION_SCRIPT

# Copy provision script to server and execute
log "Uploading provision script..."
scp -P "$REMOTE_PORT" ${SSH_KEY:+-i "$SSH_KEY"} /tmp/provision.sh "${REMOTE_USER}@${REMOTE_HOST}:/tmp/provision.sh"

log "Executing provision script on server..."
"${SSH_CMD[@]}" "bash /tmp/provision.sh '$REPO_URL_ESC' '$REMOTE_PATH_ESC' '$DOMAIN_ESC'"

rm -f /tmp/provision.sh

echo ""
echo "========================================="
echo "  ✅ Server Provisioning Complete!"
echo "========================================="
echo ""
echo "Next: SSH to server and complete .env configuration"
echo ""
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST}"
echo "  cd ${REMOTE_PATH}"
echo "  nano .env  # Add Telegram bot tokens"
echo "  ./init.sh"
echo ""
