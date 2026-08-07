#!/usr/bin/env bash
# Instala Asfalia como daemon 24/7 de la entidad (systemd).
# Uso: sudo bash scripts/install-daemon.sh [usuario]
set -euo pipefail
USER_NAME="${1:-$(logname)}"
DEST=/opt/asfalia

echo "Instalando Asfalia como daemon para el usuario: $USER_NAME"
mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude .git ./ "$DEST/"
cd "$DEST" && npm install --omit=dev --no-audit --no-fund && npm --prefix ui install --no-audit --no-fund && npm run ui:build

sed "s/%i/$USER_NAME/" deploy/asfalia.service > /etc/systemd/system/asfalia.service
systemctl daemon-reload
systemctl enable --now asfalia.service

echo
echo "Listo. El daemon late 24/7 y sobrevive reinicios:"
echo "  estado:  systemctl status asfalia"
echo "  logs:    journalctl -u asfalia -f"
echo "  consola: http://localhost:3300/console  (solo esta maquina)"
