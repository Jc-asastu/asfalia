#!/usr/bin/env bash
# Instala Asfalia como daemon 24/7 de la entidad (systemd).
# Uso: sudo bash scripts/install-daemon.sh [usuario]
set -euo pipefail
USER_NAME="${1:-$(logname)}"
DEST=/opt/asfalia
ENV_DIR=/etc/asfalia
ENV_FILE="$ENV_DIR/asfalia.env"

if ! id "$USER_NAME" >/dev/null 2>&1; then
  echo "Usuario inexistente: $USER_NAME" >&2
  exit 1
fi
if [[ ! -f contracts/managed/asfalia/contract/index.js ]]; then
  echo "Falta el contrato compilado. Ejecuta 'npm run compile' en Codespaces antes de instalar." >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta $ENV_FILE. Crealo con ASFALIA_OWNER_SECRET, la wallet y PRIVATE_STATE_PASSWORD." >&2
  exit 1
fi
if ! grep -Eq '^ASFALIA_OWNER_SECRET=[0-9a-fA-F]{64}$' "$ENV_FILE"; then
  echo "$ENV_FILE debe contener ASFALIA_OWNER_SECRET=<64 caracteres hex>." >&2
  exit 1
fi
chmod 600 "$ENV_FILE"

echo "Instalando Asfalia como daemon para el usuario: $USER_NAME"
mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude .git ./ "$DEST/"
cd "$DEST"
npm install --omit=dev --no-audit --no-fund
npm --prefix ui install --no-audit --no-fund
npm run ui:build
npm --prefix ui prune --omit=dev --no-audit --no-fund

sed "s/%i/$USER_NAME/" deploy/asfalia.service > /etc/systemd/system/asfalia.service
systemctl daemon-reload
systemctl enable --now asfalia.service

echo
echo "Listo. El daemon late 24/7 y sobrevive reinicios:"
echo "  estado:  systemctl status asfalia"
echo "  logs:    journalctl -u asfalia -f"
echo "  consola: http://localhost:3300/console  (solo esta maquina)"
