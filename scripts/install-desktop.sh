#!/usr/bin/env bash
# Instalador de escritorio de la consola Asfalia (nivel usuario, sin sudo).
#
# Deja: el daemon como servicio de usuario (24/7, reinicio automatico) y un
# icono "Asfalia — Entity Console" en el menu/escritorio que abre la consola
# como ventana propia (modo app, sin barra de navegador).
#
# Uso:  bash scripts/install-desktop.sh [url-de-la-consola]
#       (default: http://localhost:3300/console)
set -euo pipefail
URL="${1:-http://localhost:3300/console}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DIR="$HOME/.config/asfalia"
ENV_FILE="$ENV_DIR/env"

if [ "$URL" = "http://localhost:3300/console" ] && [ ! -f "$ENV_FILE" ]; then
  OWNER_SECRET="${ASFALIA_OWNER_SECRET:-}"
  if ! [[ "$OWNER_SECRET" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "Falta ASFALIA_OWNER_SECRET (64 caracteres hex), la misma clave usada al desplegar." >&2
    exit 1
  fi
  mkdir -p "$ENV_DIR"
  chmod 700 "$ENV_DIR"
  umask 077
  printf 'ASFALIA_OWNER_SECRET=%s\n' "$OWNER_SECRET" > "$ENV_FILE"
fi

# — icono
mkdir -p "$HOME/.local/share/icons" "$HOME/.local/share/applications"
cp "$HERE/assets/asfalia.svg" "$HOME/.local/share/icons/asfalia.svg"

# — navegador en modo app (ventana propia, sin chrome del browser)
BROWSER_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [ -n "$BROWSER_BIN" ]; then
  EXEC_LINE="$BROWSER_BIN --app=$URL --window-size=1280,760"
else
  EXEC_LINE="xdg-open $URL"
fi

cat > "$HOME/.local/share/applications/asfalia.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Asfalia — Entity Console
Comment=Private solvency heartbeat (local console)
Exec=$EXEC_LINE
Icon=$HOME/.local/share/icons/asfalia.svg
Terminal=false
Categories=Office;Finance;
DESK
chmod +x "$HOME/.local/share/applications/asfalia.desktop"

# — copia al escritorio si existe
for D in "$HOME/Escritorio" "$HOME/Desktop"; do
  if [ -d "$D" ]; then
    cp "$HOME/.local/share/applications/asfalia.desktop" "$D/asfalia.desktop"
    chmod +x "$D/asfalia.desktop"
    command -v gio >/dev/null && gio set "$D/asfalia.desktop" metadata::trusted true 2>/dev/null || true
  fi
done

# — daemon como servicio de USUARIO (sin sudo): 24/7 + reinicio automatico.
#   Solo si el toolchain local puede correrlo (si la consola es remota/tunel,
#   el servicio no hace falta en esta maquina).
if [ "$URL" = "http://localhost:3300/console" ] && command -v node >/dev/null; then
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/asfalia.service" <<UNIT
[Unit]
Description=Asfalia entity daemon (solvency heartbeat)
[Service]
WorkingDirectory=$HERE
EnvironmentFile=$ENV_FILE
Environment=ASFALIA_HEARTBEAT_SEC=86400
ExecStart=$(command -v npm) run api
Restart=always
RestartSec=15
[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload || true
  systemctl --user enable asfalia.service 2>/dev/null || true
  echo "Servicio de usuario listo: systemctl --user start asfalia"
fi

echo
echo "Instalado. Busca 'Asfalia' en el menu o el icono en el escritorio."
