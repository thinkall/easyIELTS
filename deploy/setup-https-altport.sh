#!/usr/bin/env bash
#
# Serve easyIELTS over HTTPS on an ALTERNATE port (default 8443) using a real
# Let's Encrypt certificate, for hosts where 80/443 are normally taken by other
# services (e.g. a Docker app on :80 and v2ray on :443).
#
# How it works: it obtains the cert via the HTTP-01 challenge during a brief window
# when port 80 is free, then runs Caddy on :8443 with that STATIC cert — so at
# runtime Caddy never touches 80/443 (no conflict with your other services). The
# browser microphone (Speaking) works because :8443 is a trusted-HTTPS origin.
#
# Usage:
#   # 1) Free port 80 first (stop whatever uses it), e.g.:
#   #      docker stop <container>      (find it: sudo ss -ltnp '( sport = :80 )')
#   #    ...or pass the stop/start commands and let this script do it (see below).
#   sudo EASYIELTS_DOMAIN=mywx.liyangai.com bash deploy/setup-https-altport.sh
#   # 2) Re-enable your port-80 service, open inbound TCP 8443 in the firewall, then:
#   #      HOST=127.0.0.1 bash start.sh
#   # 3) Browse to  https://mywx.liyangai.com:8443
#
# Optional env:
#   EASYIELTS_HTTPS_PORT      alternate HTTPS port           (default 8443)
#   EASYIELTS_UPSTREAM        app address                    (default 127.0.0.1:3000)
#   EASYIELTS_ACME_EMAIL      email for Let's Encrypt notices (recommended)
#   EASYIELTS_PORT80_STOP_CMD command to free port 80  (e.g. "docker stop web")
#   EASYIELTS_PORT80_START_CMD command to restore it   (e.g. "docker start web")
# If the STOP/START commands are given they are also registered as certbot
# pre/post hooks, so future automatic renewals free + restore port 80 themselves.
#
set -euo pipefail

DOMAIN="${EASYIELTS_DOMAIN:-}"
HTTPS_PORT="${EASYIELTS_HTTPS_PORT:-8443}"
UPSTREAM="${EASYIELTS_UPSTREAM:-127.0.0.1:3000}"
EMAIL="${EASYIELTS_ACME_EMAIL:-}"
STOP_CMD="${EASYIELTS_PORT80_STOP_CMD:-}"
START_CMD="${EASYIELTS_PORT80_START_CMD:-}"

log() { echo "[altport] $*"; }
die() { echo "[altport] $*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "Set EASYIELTS_DOMAIN, e.g. sudo EASYIELTS_DOMAIN=example.com bash deploy/setup-https-altport.sh"
[ "$(id -u)" -eq 0 ] || die "Please run with sudo (it installs packages and writes /etc/caddy)."

port80_in_use() {
  { command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -qE '[:.]80[[:space:]]'; } \
    || { command -v lsof >/dev/null 2>&1 && lsof -iTCP:80 -sTCP:LISTEN >/dev/null 2>&1; }
}

# If a stop command was provided, use it to free port 80 ourselves.
if [ -n "$STOP_CMD" ] && port80_in_use; then
  log "Freeing port 80 via: $STOP_CMD"
  eval "$STOP_CMD" || true
  sleep 2
fi

if port80_in_use; then
  die "Port 80 is still in use. Stop the service on it first (find it: sudo ss -ltnp '( sport = :80 )'), then re-run."
fi

# --- Install certbot + Caddy if missing (Debian/Ubuntu) ---
if ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot..."
  apt-get update
  apt-get install -y certbot
fi
if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# --- Obtain the certificate via standalone HTTP-01 on the now-free port 80 ---
CERTBOT_ARGS=(certonly --standalone -d "$DOMAIN" --agree-tos -n)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(-m "$EMAIL" --no-eff-email)
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi
# Register port-80 stop/start as renewal hooks so future `certbot renew` is hands-off.
[ -n "$STOP_CMD" ]  && CERTBOT_ARGS+=(--pre-hook  "$STOP_CMD")
[ -n "$START_CMD" ] && CERTBOT_ARGS+=(--post-hook "$START_CMD")

log "Requesting a Let's Encrypt certificate for ${DOMAIN} (HTTP-01 on port 80)..."
certbot "${CERTBOT_ARGS[@]}"

LIVE="/etc/letsencrypt/live/${DOMAIN}"
[ -f "${LIVE}/fullchain.pem" ] || die "Certificate not found at ${LIVE} — certbot may have failed."

# --- Copy the cert to a Caddy-readable dir (the caddy user can't read /etc/letsencrypt) ---
CERT_DIR="/etc/caddy/certs/${DOMAIN}"
install -d -o caddy -g caddy -m 0750 /etc/caddy/certs "$CERT_DIR"
install -o caddy -g caddy -m 0644 "${LIVE}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
install -o caddy -g caddy -m 0600 "${LIVE}/privkey.pem"  "${CERT_DIR}/privkey.pem"

# --- Caddy site on the alternate port with the static cert (no ACME, never binds 80/443) ---
install -d /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
{
	# Use the supplied cert only; do not run ACME or bind 80/443.
	auto_https disable_redirects
}

${DOMAIN}:${HTTPS_PORT} {
	encode zstd gzip
	reverse_proxy ${UPSTREAM}
	tls ${CERT_DIR}/fullchain.pem ${CERT_DIR}/privkey.pem
}
EOF

# --- Renewal deploy hook: re-copy the cert to Caddy and reload it after each renewal ---
HOOK="/etc/letsencrypt/renewal-hooks/deploy/easyielts-caddy.sh"
install -d "$(dirname "$HOOK")"
cat > "$HOOK" <<EOF
#!/usr/bin/env bash
set -e
install -o caddy -g caddy -m 0644 "${LIVE}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
install -o caddy -g caddy -m 0600 "${LIVE}/privkey.pem"  "${CERT_DIR}/privkey.pem"
systemctl reload caddy 2>/dev/null || systemctl restart caddy
EOF
chmod +x "$HOOK"

systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

log "Done. easyIELTS will be served at:  https://${DOMAIN}:${HTTPS_PORT}"
log "Next steps:"
[ -z "$START_CMD" ] && log "  - re-enable your port-80 service (e.g. start the docker container)"
log "  - open inbound TCP ${HTTPS_PORT} in your cloud security group / firewall"
log "  - run the app behind Caddy:  HOST=127.0.0.1 bash start.sh"
log "  - then open  https://${DOMAIN}:${HTTPS_PORT}  (the microphone is now allowed)"
if [ -z "$STOP_CMD" ]; then
  log "Renewal: Let's Encrypt certs last ~90 days. certbot's timer will try to renew,"
  log "  but standalone renewal needs port 80 free again. Either re-run this script with"
  log "  EASYIELTS_PORT80_STOP_CMD/EASYIELTS_PORT80_START_CMD set (so renewals are automatic),"
  log "  or briefly free port 80 and run 'sudo certbot renew' every ~60 days."
else
  log "Renewal is automatic: the stop/start commands are registered as certbot hooks."
fi
