#!/usr/bin/env bash
#
# easyIELTS HTTPS on an ALTERNATE port (default 8443) — END-TO-END setup AND renewal.
#
# For hosts where ports 80/443 are taken by other services (e.g. a Docker app on
# :80 and v2ray on :443). The browser microphone (Speaking) needs a trusted-HTTPS
# origin, which the port number doesn't affect — so we serve on :8443.
#
# This ONE script handles both first-time setup and later renewals:
#   - It needs port 80 free only briefly (for the Let's Encrypt HTTP-01 challenge).
#     You free it MANUALLY; the script checks and waits/reminds you if it's still in use.
#   - It obtains (first run) or renews (later runs) the certificate, then serves it
#     with Caddy on :8443 — at runtime Caddy never binds 80/443.
#
# Usage (same command for setup and renewal):
#   # 1) Free port 80 manually, e.g.:  docker stop <container>
#   sudo EASYIELTS_DOMAIN=mywx.liyangai.com bash deploy/setup-https-altport.sh
#   # 2) Re-enable your port-80 service.  First run only: open TCP 8443 in the
#   #    firewall and start the app:  HOST=127.0.0.1 bash start.sh
#   # 3) Browse to  https://mywx.liyangai.com:8443
#
# Optional env:
#   EASYIELTS_HTTPS_PORT   alternate HTTPS port             (default 8443)
#   EASYIELTS_UPSTREAM     app address                      (default 127.0.0.1:3000)
#   EASYIELTS_ACME_EMAIL   email for Let's Encrypt notices  (recommended)
#   EASYIELTS_FORCE_RENEW  set to 1 to force renewal even if not near expiry
#
set -euo pipefail

DOMAIN="${EASYIELTS_DOMAIN:-}"
HTTPS_PORT="${EASYIELTS_HTTPS_PORT:-8443}"
UPSTREAM="${EASYIELTS_UPSTREAM:-127.0.0.1:3000}"
EMAIL="${EASYIELTS_ACME_EMAIL:-}"
FORCE_RENEW="${EASYIELTS_FORCE_RENEW:-0}"

log()  { echo "[altport] $*"; }
warn() { echo "[altport] $*" >&2; }
die()  { echo "[altport] $*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "Set EASYIELTS_DOMAIN, e.g. sudo EASYIELTS_DOMAIN=example.com bash deploy/setup-https-altport.sh"
[ "$(id -u)" -eq 0 ] || die "Please run with sudo (it installs packages and writes /etc/caddy)."

port80_in_use() {
  { command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -qE '[:.]80[[:space:]]'; } \
    || { command -v lsof >/dev/null 2>&1 && lsof -iTCP:80 -sTCP:LISTEN >/dev/null 2>&1; }
}

show_port80_holder() {
  if command -v ss >/dev/null 2>&1; then
    warn "Currently using port 80:"
    ss -ltnp '( sport = :80 )' 2>/dev/null | sed 's/^/[altport]   /' >&2 || true
  fi
}

# --- Ensure port 80 is free (the user frees it manually; we check + remind) ---
ensure_port80_free() {
  if ! port80_in_use; then
    log "Port 80 is free — good (needed only briefly for the certificate challenge)."
    return
  fi

  warn "Port 80 is in use. Free it MANUALLY before continuing — e.g. stop the"
  warn "service that owns it (commonly a Docker container):  docker stop <container>"
  show_port80_holder

  if [ ! -t 0 ]; then
    die "Not running interactively; aborting. Stop the port-80 service and re-run."
  fi

  local attempt
  for attempt in 1 2 3 4 5; do
    printf '[altport] After you have stopped it, press Enter to re-check (Ctrl-C to abort)... '
    read -r _ || die "Aborted."
    if ! port80_in_use; then
      log "Port 80 is now free. Continuing."
      return
    fi
    warn "Port 80 is still in use."
    show_port80_holder
  done
  die "Port 80 is still in use after several checks. Aborting."
}

# --- Install certbot + Caddy if missing (Debian/Ubuntu) ---
install_prereqs() {
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
}

LIVE="/etc/letsencrypt/live/${DOMAIN}"
CERT_DIR="/etc/caddy/certs/${DOMAIN}"

# Does the certificate need to be obtained (first time) or renewed (near expiry)?
# Lets this script be called on every launch and only touch port 80 when needed.
cert_needs_action() {
  [ "$FORCE_RENEW" = "1" ] && return 0
  [ -f "${LIVE}/fullchain.pem" ] || return 0      # first time
  # Renew when fewer than 30 days remain.
  if openssl x509 -checkend "$(( 30*24*3600 ))" -noout -in "${LIVE}/fullchain.pem" >/dev/null 2>&1; then
    return 1                                        # still valid > 30 days
  fi
  return 0                                          # expiring soon
}

# --- Obtain (first run) or renew (later runs) the certificate via HTTP-01 on :80 ---
obtain_or_renew_cert() {
  if [ -d "$LIVE" ]; then
    log "Existing certificate found — renewing if due (mode: RENEWAL)."
    local args=(renew --cert-name "$DOMAIN")
    [ "$FORCE_RENEW" = "1" ] && args+=(--force-renewal)
    certbot "${args[@]}"
  else
    log "No certificate yet — requesting a new one (mode: FIRST-TIME SETUP)."
    local args=(certonly --standalone -d "$DOMAIN" --agree-tos -n)
    if [ -n "$EMAIL" ]; then
      args+=(-m "$EMAIL" --no-eff-email)
    else
      args+=(--register-unsafely-without-email)
    fi
    certbot "${args[@]}"
  fi
  [ -f "${LIVE}/fullchain.pem" ] || die "Certificate not found at ${LIVE} — certbot may have failed."
}

# --- Copy the cert into a Caddy-readable dir (caddy user can't read /etc/letsencrypt) ---
copy_cert_for_caddy() {
  install -d -o caddy -g caddy -m 0750 /etc/caddy/certs "$CERT_DIR"
  install -o caddy -g caddy -m 0644 "${LIVE}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
  install -o caddy -g caddy -m 0600 "${LIVE}/privkey.pem"  "${CERT_DIR}/privkey.pem"
}

# --- Caddy site on the alternate port with the static cert (no ACME, never binds 80/443) ---
write_caddyfile() {
  install -d /etc/caddy
  cat > /etc/caddy/Caddyfile <<EOF
{
	# Use the supplied certificate only; do not run ACME or bind 80/443.
	auto_https disable_redirects
}

${DOMAIN}:${HTTPS_PORT} {
	encode zstd gzip
	reverse_proxy ${UPSTREAM}
	tls ${CERT_DIR}/fullchain.pem ${CERT_DIR}/privkey.pem
}
EOF
}

# --- certbot deploy hook: re-copy the cert to Caddy + reload, after any future renewal ---
install_deploy_hook() {
  local hook="/etc/letsencrypt/renewal-hooks/deploy/easyielts-caddy.sh"
  install -d "$(dirname "$hook")"
  cat > "$hook" <<EOF
#!/usr/bin/env bash
set -e
install -o caddy -g caddy -m 0644 "${LIVE}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
install -o caddy -g caddy -m 0600 "${LIVE}/privkey.pem"  "${CERT_DIR}/privkey.pem"
systemctl reload caddy 2>/dev/null || systemctl restart caddy
EOF
  chmod +x "$hook"
}

# --- Open the HTTPS port in the local firewall (best-effort; only when one is active) ---
open_local_firewall() {
  local port="$1"
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi '^Status: active'; then
    log "Opening ${port}/tcp in ufw..."
    ufw allow "${port}/tcp" >/dev/null 2>&1 || warn "Could not add ufw rule for ${port}/tcp."
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    log "Opening ${port}/tcp in firewalld..."
    firewall-cmd --permanent --add-port="${port}/tcp" >/dev/null 2>&1 \
      && firewall-cmd --reload >/dev/null 2>&1 \
      || warn "Could not add firewalld rule for ${port}/tcp."
  else
    log "No active local firewall (ufw/firewalld) detected — nothing to open locally."
  fi
}

# ---------------------------------------------------------------------------
install_prereqs
if cert_needs_action; then
  log "Certificate needs issuing or renewal."
  ensure_port80_free      # only prompts to free port 80 when actually needed
  obtain_or_renew_cert
else
  log "Certificate is present and valid (>30 days) — no cert action needed."
fi
copy_cert_for_caddy
write_caddyfile
install_deploy_hook
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
open_local_firewall "$HTTPS_PORT"

log "Done. easyIELTS HTTPS is configured at:  https://${DOMAIN}:${HTTPS_PORT}"
log "Now:"
log "  - re-enable your port-80 service (e.g. start the docker container you stopped)"
log "  - open inbound TCP ${HTTPS_PORT} in your CLOUD security group (the VM can't do this for you)"
log "  - (first time) run the app behind Caddy:  HOST=127.0.0.1 bash start.sh"
log "  - open  https://${DOMAIN}:${HTTPS_PORT}  — the microphone is now allowed"
log ""
log "TO RENEW LATER: certbot's automatic timer can't bind port 80 here, so renew"
log "  manually every ~60 days: free port 80, then re-run THIS SAME command:"
log "    sudo EASYIELTS_DOMAIN=${DOMAIN} bash deploy/setup-https-altport.sh"
