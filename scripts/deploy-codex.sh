#!/usr/bin/env bash
set -euo pipefail

# beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${TARGET_DIR:-/opt/qbitos-freya}"
ENV_TARGET="${ENV_TARGET:-/etc/qbitos/freya-codex.env}"
SYSTEMD_TARGET="${SYSTEMD_TARGET:-/etc/systemd/system/freya-codex-api.service}"
UVSPEED_SOURCE_DIR="${UVSPEED_SOURCE_DIR:-}"

echo "[deploy] root: ${ROOT_DIR}"
echo "[deploy] target: ${TARGET_DIR}"

sudo mkdir -p "${TARGET_DIR}"
sudo rsync -a --delete \
  --exclude ".git" \
  --exclude ".venv" \
  --exclude "__pycache__" \
  "${ROOT_DIR}/" "${TARGET_DIR}/"

if [[ -n "${UVSPEED_SOURCE_DIR}" && -d "${UVSPEED_SOURCE_DIR}" ]]; then
  echo "[deploy] syncing quantum runtime modules from: ${UVSPEED_SOURCE_DIR}"
  for f in quantum-prefixes.js qbit-dac.js qbit-steno.js qbit-preflight.js; do
    if [[ -f "${UVSPEED_SOURCE_DIR}/${f}" ]]; then
      sudo cp "${UVSPEED_SOURCE_DIR}/${f}" "${TARGET_DIR}/${f}"
      echo "[deploy] copied ${f}"
    fi
  done
else
  echo "[deploy] UVSPEED_SOURCE_DIR not set; skipping external module sync"
fi

if [[ ! -f "${ENV_TARGET}" ]]; then
  echo "[deploy] creating env file template: ${ENV_TARGET}"
  sudo mkdir -p "$(dirname "${ENV_TARGET}")"
  sudo cp "${TARGET_DIR}/deploy/env/codex_api.env.example" "${ENV_TARGET}"
  echo "[deploy] edit ${ENV_TARGET} and set real CODEX_API_KEYS before production use"
fi

echo "[deploy] installing systemd unit: ${SYSTEMD_TARGET}"
sudo cp "${TARGET_DIR}/deploy/systemd/freya-codex-api.service" "${SYSTEMD_TARGET}"

echo "[deploy] reloading and restarting service"
sudo systemctl daemon-reload
sudo systemctl enable freya-codex-api
sudo systemctl restart freya-codex-api
sudo systemctl status freya-codex-api --no-pager

echo "[deploy] health probe"
curl -fsS "http://127.0.0.1:8787/health" | sed 's/^/[health] /'

echo "[deploy] integration probe"
curl -fsS "http://127.0.0.1:8787/api/v1/system/integration" | sed 's/^/[integration] /'

echo "[deploy] done"
