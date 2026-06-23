#!/usr/bin/env bash
#
# Serve easyIELTS over HTTPS so the Speaking module's microphone works.
#
# Browsers block getUserMedia on insecure origins (plain HTTP on a public domain).
# This installs Caddy (Debian/Ubuntu) and configures it as a reverse proxy that
# terminates TLS (auto Let's Encrypt) on 443 and forwards to the Node app on :3000,
# including the live-speaking WebSocket.
#
# Usage:
#   sudo EASYIELTS_DOMAIN=mywx.liyangai.com bash deploy/setup-https.sh
#
# Prerequisites:
#   - DNS for the domain points to this server.
#   - Ports 80 and 443 are open in your cloud security group / firewall.
#   - The app is running (bash start.sh) on the upstream (default 127.0.0.1:3000).
#
set -euo pipefail

DOMAIN="${EASYIELTS_DOMAIN:-}"
UPSTREAM="${EASYIELTS_UPSTREAM:-127.0.0.1:3000}"

if [ -z "$DOMAIN" ]; then
  echo "[setup-https] Set EASYIELTS_DOMAIN, e.g.:" >&2
  echo "  sudo EASYIELTS_DOMAIN=example.com bash deploy/setup-https.sh" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "[setup-https] Please run with sudo (it installs Caddy and binds ports 80/443)." >&2
  exit 1
fi

# --- Install Caddy if missing (official Debian/Ubuntu repo) ---
if ! command -v caddy >/dev/null 2>&1; then
  echo "[setup-https] Installing Caddy..."
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
else
  echo "[setup-https] Caddy already installed ($(caddy version | head -n1))."
fi

# --- Write the site config and (re)start Caddy as a systemd service ---
echo "[setup-https] Writing /etc/caddy/Caddyfile for ${DOMAIN} -> ${UPSTREAM}"
install -d /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	encode zstd gzip
	reverse_proxy ${UPSTREAM}
}
EOF

systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo "[setup-https] Done. Caddy is serving https://${DOMAIN} -> ${UPSTREAM}"
echo "[setup-https] Make sure:"
echo "  - ports 80 and 443 are open in your cloud firewall,"
echo "  - the app is running:  bash start.sh"
echo "  - then open  https://${DOMAIN}  (the mic will now be allowed)."
