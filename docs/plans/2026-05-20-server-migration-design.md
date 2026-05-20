# Server migration design — vgulcover.ru → 77.91.65.252

**Date:** 2026-05-20
**Source:** 89.223.64.110 (spb-3-vm-ondg, Ubuntu, 29G/1.9G, single-project)
**Target:** 77.91.65.252 (violent-feet.yeezyhost.net, Ubuntu 24.04, 246G/31G, multi-project)
**Domain:** vgulcover.ru

## Context

The musicians project runs on a small dedicated server. The user is consolidating all projects on a single bigger box (77.91.65.252) that already hosts `miur`, `quardo`, `bigtorgpred`, `elot`. That server uses a **host-level nginx as reverse proxy** — each project's frontend listens on `127.0.0.1:80XX`, host nginx terminates TLS and proxies by `server_name`. Certbot also lives on the host and manages all certs centrally.

At time of writing, **DNS for vgulcover.ru has already been switched to 77.91.65.252**. The site is currently broken (TLS error: host nginx serves a default cert) until this migration completes.

## Goals

1. Move full stack to target server with **no data loss** (Postgres DB is the source of truth).
2. Follow the target server's established pattern (host nginx + 127.0.0.1:80XX backends).
3. Keep source server alive for **7 days** as rollback option.
4. Acceptable downtime: ~15–30 minutes (night-time, no users).

## Decisions (locked-in)

| Question | Decision |
|---|---|
| Reverse proxy | Host nginx on target (existing pattern) |
| TLS termination | Host nginx + host certbot, **not** inside the container |
| Internal port | `127.0.0.1:8084` (next free in target's 80XX range) |
| Downtime window | ~5–10 min for DB dump+restore + service start |
| DNS | Already switched, no action required |
| Source server fate | Containers stopped, machine alive 7 days, then `docker compose down` |
| DB transfer | `pg_dump -F c` → scp → `pg_restore` (71 MB) |
| Uploads transfer | tarball of docker volume → scp → extract (8 MB) |
| Redis | Fresh start (only 88B of config, no persistent state needed) |

## Architecture (target)

```
                Internet (TLS)
                       │
                       ▼
               host nginx :443
            (server_name vgulcover.ru)
                       │
                       │ HTTP proxy_pass
                       ▼
        127.0.0.1:8084  ──►  musicians-frontend (nginx, HTTP-only)
                                │
                                │ /api/, /socket.io/, /uploads/ via docker DNS
                                ▼
                       musicians-backend:3000  (internal network only)
                                │
                ┌───────────────┴────────────────┐
                ▼                                 ▼
       musicians-db (postgres:16)        musicians-redis (redis:7)
       postgres_data volume              redis_data volume
                                          (uploads_data volume on backend)
```

Host certbot manages `vgulcover.ru` cert in `/etc/letsencrypt/live/vgulcover.ru/`. Renewal uses `--webroot -w /var/www/certbot` (matching existing target-server pattern) plus a deploy-hook that runs `systemctl reload nginx`.

## Repo changes

Three files in the repo to support running behind a host reverse proxy:

1. **New `frontend/nginx/nginx-behind-proxy.conf`** — single `server { listen 80; ... }` block. No SSL config, no HTTPS redirect (host nginx already does that). Keeps all the location blocks (`/assets/`, `/api/`, `/socket.io/`, `/uploads/`, SPA fallback) plus `/health` on port 80.

2. **`frontend/Dockerfile`** — change `COPY nginx/nginx.conf …` to use a build ARG:
   ```dockerfile
   ARG NGINX_CONF=nginx/nginx.conf
   COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
   ```
   Default value preserves current behaviour for the old server.

3. **New `docker-compose.host-proxy.yml`** — override file for the target. Sets:
   ```yaml
   frontend:
     build:
       args:
         NGINX_CONF: nginx/nginx-behind-proxy.conf
     ports: ["127.0.0.1:8084:80"]   # no :443 line
     volumes: []                     # no /etc/letsencrypt mount
   ```
   Used via `docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d`.

The two compose files are independent — old server keeps using the single `docker-compose.yml` for rollback compatibility during the 7-day window.

## Host-nginx vhost (target)

File: `/etc/nginx/sites-available/vgulcover.ru.conf`, symlink to `sites-enabled/`.

```nginx
# ACME + redirect
server {
    listen 80;
    listen [::]:80;
    server_name vgulcover.ru www.vgulcover.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# TLS + proxy
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vgulcover.ru www.vgulcover.ru;

    ssl_certificate     /etc/letsencrypt/live/vgulcover.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vgulcover.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 64m;  # for image uploads via /api/

    location / {
        proxy_pass http://127.0.0.1:8084;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Cert obtained via `certbot certonly --webroot -w /var/www/certbot -d vgulcover.ru -m monstrpete@gmail.com --agree-tos -n`.

## Data flow

1. **Freeze source**: `docker stop musicians-frontend musicians-backend` on 89.223.64.110. Postgres + Redis stay up for the dump but no writes arrive.
2. **DB dump**: `docker exec musicians-db pg_dump -U musicians -F c -d musicians_db -f /tmp/dump.pgc`, then `docker cp` to host, then `scp` to target.
3. **Uploads tarball**: `tar -C /var/lib/docker/volumes/musicians_uploads_data/_data -czf /tmp/uploads.tgz .`, then `scp` to target.
4. **Env**: `scp /opt/musicians/.env` to target (contains DB password, JWT secret, Telegram tokens).
5. **Target prepare**: `git clone` (or rsync) repo to `/opt/musicians/`, place `.env`, `docker compose -f docker-compose.yml -f docker-compose.host-proxy.yml up -d postgres redis` (DB initializes empty).
6. **Restore**: `docker exec -i musicians-db pg_restore -U musicians -d musicians_db --clean --if-exists < /tmp/dump.pgc`.
7. **Restore uploads**: extract tarball into target uploads volume.
8. **Start app**: `docker compose ... up -d backend frontend`.
9. **Wire host nginx**: drop in vhost file, `nginx -t`, run certbot, `systemctl reload nginx`.
10. **Verify**: `curl https://vgulcover.ru/` (200), `curl https://vgulcover.ru/api/...` (any backend route), check frontend page, test admin login.

## Rollback

If `curl https://vgulcover.ru/` fails or data is corrupt:

1. Revert DNS A record → 89.223.64.110 (~1 min if registrar has fast TTL).
2. Restart source containers: `docker compose up -d` in `/opt/musicians/` on 89.223.64.110.
3. The source server still has unchanged data and the prior cert valid until Aug 3.

The 7-day grace window protects against finding a problem hours/days later.

## Testing checklist (post-migration)

- [ ] `https://vgulcover.ru/` returns 200 with valid Let's Encrypt cert
- [ ] Frontend loads, shows the formats list (gangsters / Welcome / Дуэт / 90-ые)
- [ ] `/api/residents` (or another GET) returns data — confirms backend + DB connection
- [ ] Admin login works — confirms JWT secret carried over
- [ ] Image upload works — confirms uploads volume + body size limit
- [ ] Healthcheck `docker ps` shows `musicians-frontend (healthy)`
- [ ] `certbot renew --dry-run` succeeds via webroot

## Out of scope

- Migrating historical backups in `/opt/musicians/backups/` (97 MB of old .sql dumps — not needed; pg_dump on cutover captures current state).
- Backend logs volume (transient).
- Setting up new automated cron pg_dump on target — can be done separately, source still has it for the 7-day window.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Port 8084 already in use on target | Will check via `ss -tln` before. Pick next free if conflict. |
| Cert issuance hits Let's Encrypt rate limit | We already have a valid cert on the source; if rate-limited, copy `/etc/letsencrypt/live/vgulcover.ru/` from source to target (less clean but works) |
| `pg_restore` fails due to extension or version mismatch | Both use postgres:16-alpine → no mismatch. If extensions exist, restore with `--no-owner --no-acl` |
| Uploads volume path differs (compose project name change) | Verify volume name `musicians_uploads_data` is consistent; if not, restore by `docker cp` |
| DNS still cached at some resolvers, sending users to old | Old containers stopped → users see error there. Brief inconvenience; resolves in TTL. |
