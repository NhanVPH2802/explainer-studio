#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/explainer-studio"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo " Explainer Studio - Installer"
echo "========================================"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo "Vui long chay bang sudo:"
  echo "sudo bash install.sh"
  exit 1
fi

echo "[1/9] Cap nhat he thong va cai goi can thiet"
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  rsync \
  python3 \
  python3-pip \
  ffmpeg \
  build-essential

echo "[2/9] Kiem tra Node.js"
NEED_NODE=0

if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    NEED_NODE=1
  fi
fi

if [ "$NEED_NODE" -eq 1 ]; then
  echo "Cai Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)"
echo "NPM : $(npm -v)"
echo "FFmpeg: $(ffmpeg -version | head -n 1)"

echo "[3/9] Tao thu muc ung dung"
mkdir -p "$APP_DIR"

echo "[4/9] Copy source vao $APP_DIR"
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='output' \
  --exclude='outputs' \
  --exclude='logs' \
  "$SOURCE_DIR/" "$APP_DIR/"

cd "$APP_DIR"

echo "[5/9] Tao cac thu muc runtime"
mkdir -p \
  data/scripts \
  data/render-props \
  public/audio \
  public/generated \
  public/custom-assets/fonts \
  public/custom-assets/backgrounds \
  logs

if [ ! -f data/render-jobs.json ]; then
  echo '{"jobs":[]}' > data/render-jobs.json
fi

if [ ! -f data/compositions-cache.json ]; then
  echo '[]' > data/compositions-cache.json
fi

echo "[6/9] Cai Node dependencies"
npm ci

echo "[7/9] Kiem tra source"
npm run lint

echo "[8/9] Tao systemd services"

cat >/etc/systemd/system/explainer-studio-backend.service <<'SERVICE'
[Unit]
Description=Explainer Studio Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/explainer-studio
ExecStart=/usr/bin/node /opt/explainer-studio/server/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

cat >/etc/systemd/system/explainer-studio-web.service <<'SERVICE'
[Unit]
Description=Explainer Studio Web UI
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/explainer-studio/web
ExecStart=/usr/bin/python3 -m http.server 8080 --bind 0.0.0.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

cat >/etc/systemd/system/explainer-template-assets.service <<'SERVICE'
[Unit]
Description=Explainer Studio Template Assets
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/explainer-studio
ExecStart=/usr/bin/node /opt/explainer-studio/tools/template-assets-server.mjs
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload

systemctl enable \
  explainer-studio-backend \
  explainer-studio-web \
  explainer-template-assets

systemctl restart \
  explainer-studio-backend \
  explainer-studio-web \
  explainer-template-assets

echo "[9/9] Kiem tra dich vu"
sleep 3

systemctl --no-pager --full status explainer-studio-backend | head -n 12
systemctl --no-pager --full status explainer-studio-web | head -n 12
systemctl --no-pager --full status explainer-template-assets | head -n 12

SERVER_IP="$(hostname -I | awk '{print $1}')"

echo
echo "========================================"
echo " EXPLAINER STUDIO INSTALLED"
echo "========================================"
echo
echo "Web UI       : http://${SERVER_IP}:8080"
echo "Backend API  : http://${SERVER_IP}:8081"
echo "Template API : http://${SERVER_IP}:8082"
echo
echo "Thu muc app  : $APP_DIR"
echo
echo "Buoc tiep theo:"
echo "1. Mo Web UI"
echo "2. Vao Providers"
echo "3. Cau hinh AI Provider"
echo "4. Cau hinh VieNeu-TTS neu su dung"
echo "5. Kiem tra ket noi"
echo
