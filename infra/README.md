# infra/

Sanitised copies of host-level configuration that lives on production
boxes but isn't part of the docker stack itself.

## host-nginx/

Vhost files for the host-level nginx reverse proxy on the multi-tenant
server (77.91.65.252). Install at `/etc/nginx/sites-available/` and
symlink into `sites-enabled/`.

## letsencrypt/

Certbot deploy hooks. Install at
`/etc/letsencrypt/renewal-hooks/deploy/` and `chmod +x`.

## Not committed: the actual production files

These are `.example` files because the live versions can drift (extra
projects, internal IPs, etc.) and we don't want git to fight with hand
edits on the host. Treat them as the canonical template — diff against
the host before changing.
