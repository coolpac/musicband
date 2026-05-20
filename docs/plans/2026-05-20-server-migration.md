# Server Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move musicians stack from 89.223.64.110 to 77.91.65.252 behind the host-nginx reverse proxy, preserving Postgres data and uploads.

**Architecture:** Frontend container listens on 127.0.0.1:8084 (HTTP only). Host nginx terminates TLS for vgulcover.ru and proxies to that port. Backend/db/redis stay on the internal docker network. Host certbot issues and renews the cert via webroot.

**Tech Stack:** Docker Compose v2, postgres:16-alpine, redis:7-alpine, nginx:1.27-alpine, host nginx + certbot, Let's Encrypt.

**Design doc:** `docs/plans/2026-05-20-server-migration-design.md`

**Urgent context:** DNS for vgulcover.ru has already been switched to 77.91.65.252. The site is currently down (host nginx serves default cert). Execute tasks promptly.

**Constants used throughout:**
- `SRC=89.223.64.110`, `TGT=77.91.65.252`, `KEY=~/.ssh/id_ed25519_deploy`
- `PORT=8084` (frontend host port on target)
- `DOMAIN=vgulcover.ru`
- `EMAIL=monstrpete@gmail.com`

---

## Phase 1 — Repo changes (local)

### Task 1: Add HTTP-only nginx config for behind-proxy mode

**Files:**
- Create: `frontend/nginx/nginx-behind-proxy.conf`

**Step 1: Write the config**

Content:
```nginx
# Frontend nginx — runs behind host-level nginx reverse proxy.
# No SSL here: host nginx terminates TLS and forwards plain HTTP.
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 2m;
    client_body_buffer_size 128k;

    # Healthcheck (exact match, no logs)
    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 'ok';
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;
    gzip_static on;

    # Hashed asset bundles
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    location /js/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API → backend
    location /api/ {
        client_max_body_size 64m;
        client_body_buffer_size 256k;
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public";
    }

    # index.html — never cache
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

**Step 2: Verify file syntax via docker (optional but fast)**

```bash
docker run --rm -v "$PWD/frontend/nginx/nginx-behind-proxy.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine nginx -t
```
Expected: `syntax is ok` / `test is successful`.

### Task 2: Parameterise Dockerfile nginx config

**Files:**
- Modify: `frontend/Dockerfile` (the `COPY nginx/nginx.conf …` line around line 30)

**Step 1: Replace the COPY line with an ARG-driven copy**

Find:
```dockerfile
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
```
Replace with:
```dockerfile
ARG NGINX_CONF=nginx/nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
```

**Step 2: Verify default build still works**

```bash
cd frontend && docker build -t musicians-frontend:test . && cd ..
```
Expected: build succeeds. Inside the image, `/etc/nginx/conf.d/default.conf` must equal `frontend/nginx/nginx.conf`.

Check:
```bash
docker run --rm musicians-frontend:test cat /etc/nginx/conf.d/default.conf | head -3
```
Expected: starts with `# HTTP → HTTPS редирект`.

### Task 3: Add docker-compose override for host-proxy mode

**Files:**
- Create: `docker-compose.host-proxy.yml`

**Step 1: Write the override**

Content:
```yaml
# Override for hosts where TLS is terminated by a host-level reverse proxy.
# Usage: docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d
services:
  frontend:
    build:
      args:
        NGINX_CONF: nginx/nginx-behind-proxy.conf
    ports: !override
      - "127.0.0.1:${HOST_PROXY_PORT:-8084}:80"
    volumes: !override []
```

Note: `!override` resets the list rather than appending — needed because the base file declares port 443 and the letsencrypt mount, which we don't want here.

**Step 2: Verify the merged config parses**

```bash
docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml config | grep -E '(ports:|443|letsencrypt|8084)' -A1
```
Expected: `8084:80` shown, no `443`, no `letsencrypt` mount.

### Task 4: Commit Phase 1 changes

**Step 1: Commit**

```bash
git add frontend/nginx/nginx-behind-proxy.conf frontend/Dockerfile docker-compose.host-proxy.yml
git -c commit.gpgsign=false commit -m "infra: add host-proxy mode for multi-tenant servers"
```

**Step 2: Push**

```bash
git push origin main
```

---

## Phase 2 — Prepare target server

### Task 5: Verify target port and prereqs

**Step 1: Confirm 8084 free, certbot installed, nginx running**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "ss -tln | grep ':8084 ' || echo '8084 FREE'; which certbot && systemctl is-active nginx"
```
Expected: `8084 FREE`, certbot path, `active`.

### Task 6: Create target project dir and clone repo

**Step 1: Clone**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "mkdir -p /opt/musicians && cd /opt/musicians && git clone https://github.com/coolpac/musicband.git . && git log --oneline -3"
```
Expected: head shows commit `9fd0dbb` (design doc) or later.

**Step 2: Make scripts executable**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "chmod +x /opt/musicians/deploy.sh /opt/musicians/scripts/*.sh 2>/dev/null; ls -la /opt/musicians/*.sh"
```

### Task 7: Ensure webroot dir for certbot exists on host

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "mkdir -p /var/www/certbot/.well-known/acme-challenge && chmod -R 755 /var/www/certbot"
```

---

## Phase 3 — Freeze source and transfer data

### Task 8: Freeze writes on source

**Step 1: Stop frontend + backend (Postgres stays up for the dump)**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 \
  "docker stop musicians-frontend musicians-backend && docker ps --format 'table {{.Names}}\t{{.Status}}'"
```
Expected: frontend/backend stopped, db + redis still up.

### Task 9: Dump Postgres on source, transfer to target

**Step 1: Dump**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 \
  "docker exec musicians-db pg_dump -U musicians -F c -d musicians_db -f /tmp/dump.pgc && docker cp musicians-db:/tmp/dump.pgc /tmp/dump.pgc && ls -la /tmp/dump.pgc"
```
Expected: file ~10–50 MB (compressed custom format).

**Step 2: Transfer source → target (via local hop is fine, but server-to-server is fewer hops)**

Server-to-server (requires source to have target's key — try; if it fails, fall back to local hop):

Local hop (safe default):
```bash
scp -i ~/.ssh/id_ed25519_deploy root@89.223.64.110:/tmp/dump.pgc /tmp/musicians-dump.pgc
scp -i ~/.ssh/id_ed25519_deploy /tmp/musicians-dump.pgc root@77.91.65.252:/tmp/dump.pgc
```
Expected: file present on target.

### Task 10: Transfer uploads volume

**Step 1: Tar on source**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 \
  "tar -C /var/lib/docker/volumes/musicians_uploads_data/_data -czf /tmp/uploads.tgz . && ls -la /tmp/uploads.tgz"
```
Expected: ~8 MB tarball.

**Step 2: Transfer to target**

```bash
scp -i ~/.ssh/id_ed25519_deploy root@89.223.64.110:/tmp/uploads.tgz /tmp/musicians-uploads.tgz
scp -i ~/.ssh/id_ed25519_deploy /tmp/musicians-uploads.tgz root@77.91.65.252:/tmp/uploads.tgz
```

### Task 11: Copy .env to target

**Step 1:**

```bash
scp -i ~/.ssh/id_ed25519_deploy root@89.223.64.110:/opt/musicians/.env /tmp/musicians.env
scp -i ~/.ssh/id_ed25519_deploy /tmp/musicians.env root@77.91.65.252:/opt/musicians/.env
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "chmod 600 /opt/musicians/.env && wc -l /opt/musicians/.env"
```

**Step 2: Adjust FRONTEND_URL if needed**

It's already `https://vgulcover.ru`. Verify:
```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "grep -E '^(FRONTEND_URL|MINI_APP_URL)=' /opt/musicians/.env"
```
Expected: both = `https://vgulcover.ru`.

**Step 3: Wipe the temporary local .env copy**

```bash
shred -u /tmp/musicians.env 2>/dev/null || rm -f /tmp/musicians.env
```

---

## Phase 4 — Start target stack

### Task 12: Start db + redis on target

**Step 1: Bring up only DB and Redis**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "cd /opt/musicians && docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d postgres redis"
```

**Step 2: Wait for healthy**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "for i in 1 2 3 4 5 6; do s=\$(docker inspect --format='{{.State.Health.Status}}' musicians-db 2>/dev/null); echo \"\$i db=\$s\"; [ \"\$s\" = healthy ] && break; sleep 5; done"
```
Expected: `db=healthy` within 30 s.

### Task 13: Restore database

**Step 1: Copy dump into container and restore**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "docker cp /tmp/dump.pgc musicians-db:/tmp/dump.pgc && docker exec musicians-db pg_restore -U musicians -d musicians_db --clean --if-exists --no-owner --no-acl /tmp/dump.pgc 2>&1 | tail -20"
```
Expected: no `ERROR:` lines (a few harmless WARNINGs OK).

**Step 2: Smoke-check row counts**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "docker exec musicians-db psql -U musicians -d musicians_db -c \"SELECT 'residents' AS t, count(*) FROM residents UNION ALL SELECT 'admins', count(*) FROM admins\" 2>&1 | head -10"
```
Expected: non-zero rows for residents/admins (table names may vary; this confirms restore worked).

### Task 14: Restore uploads

**Step 1: Create the volume by inspecting compose, then unpack into it**

The volume materialises after the first `compose up`. Confirm:
```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "docker volume ls | grep uploads"
```
Expected: `musicians_uploads_data` listed.

Unpack via a throwaway container:
```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "docker run --rm -v musicians_uploads_data:/dst -v /tmp/uploads.tgz:/tmp/uploads.tgz:ro alpine sh -c 'cd /dst && tar -xzf /tmp/uploads.tgz && ls | head -5 && du -sh .'"
```
Expected: extraction succeeds, ~8 MB.

### Task 15: Start backend + frontend

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "cd /opt/musicians && docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d --build backend frontend"
```

**Step 2: Wait for healthy**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "for i in 1 2 3 4 5 6 7 8; do fs=\$(docker inspect --format='{{.State.Health.Status}}' musicians-frontend 2>/dev/null); bs=\$(docker inspect --format='{{.State.Health.Status}}' musicians-backend 2>/dev/null); echo \"\$i fe=\$fs be=\$bs\"; [ \"\$fs\" = healthy ] && [ \"\$bs\" = healthy ] && break; sleep 10; done"
```
Expected: both `healthy`.

### Task 16: Internal smoke test

**Step 1: Curl the stack on its local port**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "curl -sS -o /dev/null -w 'root HTTP %{http_code}\n' http://127.0.0.1:8084/ && curl -sS http://127.0.0.1:8084/health && echo"
```
Expected: `root HTTP 200`, `/health` returns `ok`.

---

## Phase 5 — Host nginx + TLS

### Task 17: Drop in temporary HTTP-only vhost (ACME-only)

**Step 1: Create the file**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "cat > /etc/nginx/sites-available/vgulcover.ru.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name vgulcover.ru www.vgulcover.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'acme-staging';
        add_header Content-Type text/plain;
    }
}
EOF
ln -sf /etc/nginx/sites-available/vgulcover.ru.conf /etc/nginx/sites-enabled/vgulcover.ru.conf
nginx -t && systemctl reload nginx"
```
Expected: `nginx -t` passes.

**Step 2: Verify ACME path reachable**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "echo 'probe-$(date +%s)' > /var/www/certbot/.well-known/acme-challenge/probe && curl -sS http://vgulcover.ru/.well-known/acme-challenge/probe && rm /var/www/certbot/.well-known/acme-challenge/probe"
```
Expected: prints the probe string.

### Task 18: Obtain cert via webroot

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "certbot certonly --webroot -w /var/www/certbot -d vgulcover.ru -m monstrpete@gmail.com --agree-tos -n 2>&1 | tail -15"
```
Expected: `Successfully received certificate`.

### Task 19: Swap vhost to TLS + proxy version

**Step 1: Overwrite the vhost**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "cat > /etc/nginx/sites-available/vgulcover.ru.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name vgulcover.ru www.vgulcover.ru;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vgulcover.ru www.vgulcover.ru;

    ssl_certificate     /etc/letsencrypt/live/vgulcover.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vgulcover.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:8084;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_read_timeout 60s;
    }
}
EOF
nginx -t && systemctl reload nginx"
```
Expected: `nginx -t` passes; reload silent.

**Note:** nginx 1.24 on Ubuntu 24.04 requires the legacy `listen 443 ssl http2;` syntax (the newer standalone `http2 on;` directive is only available in nginx 1.25.1+); we had to discover this at runtime during the migration.

### Task 20: Install renewal deploy-hook

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "mkdir -p /etc/letsencrypt/renewal-hooks/deploy && cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh && ls -la /etc/letsencrypt/renewal-hooks/deploy/"
```

### Task 21: Verify renewal --dry-run

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 \
  "certbot renew --cert-name vgulcover.ru --dry-run 2>&1 | tail -10"
```
Expected: `Congratulations, all simulated renewals succeeded`.

---

## Phase 6 — End-to-end verification

### Task 22: Public HTTPS check

**Step 1:**

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}, SSL %{ssl_verify_result}, time %{time_total}s, IP %{remote_ip}\n' https://vgulcover.ru/
echo | openssl s_client -connect vgulcover.ru:443 -servername vgulcover.ru 2>/dev/null | openssl x509 -noout -subject -dates
```
Expected: HTTP 200, SSL 0, IP 77.91.65.252, cert subject `CN=vgulcover.ru`, fresh dates.

### Task 23: Content + API check

**Step 1:**

```bash
curl -sS https://vgulcover.ru/ | grep -c '<div id="root">'
curl -sS https://vgulcover.ru/js/$(curl -sS https://vgulcover.ru/ | grep -oE '/js/index-[^"]+\.js' | head -1 | sed 's|/js/||') | grep -oE 'Основной формат «[^"]*»' | head -1
```
Expected: `1` (root div present), `Основной формат «гангстеры»`.

**Step 2: API responds**

```bash
curl -sS -o /dev/null -w 'API residents HTTP %{http_code}\n' https://vgulcover.ru/api/residents
```
Expected: 200 (or whatever the route returns when DB is populated).

### Task 24: Admin login + image upload check (manual)

Open the site in a browser:
- [ ] Frontend loads, format list shows gangsters / Welcome / Дуэт / 90-ые (no Виолончель)
- [ ] Admin panel: login with existing credentials → success (proves JWT_SECRET carried over)
- [ ] Admin: upload an image to any resident or content → success (proves uploads volume + body limit)
- [ ] Public page shows the uploaded image

If any step fails, **STOP** and switch to debugging — do not proceed to source teardown.

---

## Phase 7 — Quiesce source

### Task 25: Stop containers on source, leave VM alive

**Step 1:**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 \
  "cd /opt/musicians && docker compose down && docker ps -a --format 'table {{.Names}}\t{{.Status}}'"
```
Expected: no musicians-* containers running.

**Step 2: Document the 7-day reminder**

Add a note to the user: "Source server 89.223.64.110 is quiesced. After 7 days (≈ 2026-05-27) with no issues, decommission the VM at the provider."

### Task 26: Cleanup transient files

**Step 1: Source**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 "rm -f /tmp/dump.pgc /tmp/uploads.tgz"
```

**Step 2: Target**

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@77.91.65.252 "rm -f /tmp/dump.pgc /tmp/uploads.tgz"
```

**Step 3: Local**

```bash
rm -f /tmp/musicians-dump.pgc /tmp/musicians-uploads.tgz
```

---

## Rollback (only if any task in Phase 6 fails)

1. **Revert DNS:** change A record for vgulcover.ru back to 89.223.64.110 in registrar panel.
2. **Restart source containers:**
   ```bash
   ssh -i ~/.ssh/id_ed25519_deploy root@89.223.64.110 "cd /opt/musicians && docker compose up -d"
   ```
3. Wait for DNS propagation (TTL varies; reg.ru defaults to 30 min).
4. Verify on source: `curl --resolve vgulcover.ru:443:89.223.64.110 -sS -o /dev/null -w '%{http_code}\n' https://vgulcover.ru/` → 200.

The source cert is valid until 2026-08-03, so cert is not a rollback blocker.

---

## Notes for the executor

- **Cache warning:** every Bash call to a remote server takes ~1–3 s due to SSH handshake; group small commands.
- **Heredocs over SSH:** when sending multi-line files, use a heredoc in the *remote* shell, not the local. The `<<'EOF'` quoting prevents `$var` expansion.
- **The merged compose file:** every `docker compose` invocation on the target must include both `-f docker-compose.yml -f docker-compose.host-proxy.yml`. Easiest: define `dc="docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml"` once per remote session.
- **`!override` tag:** if Docker Compose version on target is older than 2.24, the `!override` tag may not parse. If `docker compose config` errors, drop `!override` and instead remove `:443` line from the base file via a side-edit on target (less clean but works). Check `docker compose version` first.
- **No commits between tasks** in Phase 2–7 (operational steps, not code changes). Phase 1 is the only commit-bearing phase.
