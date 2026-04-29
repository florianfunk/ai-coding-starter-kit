#!/usr/bin/env bash
# Deploy the Lichtengross LaTeX service to the Hostinger VPS.
#
# Default mode: rsync only templates/ and assets/ — the worker reads them
# read-only at request time, no container restart needed.
#
# --rebuild: rsync the full service dir and rebuild the container (needed
# when app/, Dockerfile, or requirements.txt changed).
#
# Usage:
#   scripts/deploy-latex-template.sh
#   scripts/deploy-latex-template.sh --rebuild
#
# Requires sshpass and the VPS_* + LATEX_WORKER_* vars in .env.local.

set -euo pipefail

cd "$(dirname "$0")/.."

# Load env vars without exposing them in process listings.
set -a
# shellcheck disable=SC1091
source .env.local
set +a

: "${VPS_HOST:?VPS_HOST missing in .env.local}"
: "${VPS_USER:?VPS_USER missing in .env.local}"
: "${VPS_PASSWORD:?VPS_PASSWORD missing in .env.local}"

REMOTE_DIR=/root/lichtengross-pdf-service
LOCAL_DIR=services/latex-pdf-service

REBUILD=0
if [[ "${1:-}" == "--rebuild" ]]; then
  REBUILD=1
fi

echo "→ Deploying to ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"

if (( REBUILD )); then
  # Full sync — keep .env on the server (contains the worker token), don't overwrite.
  sshpass -p "$VPS_PASSWORD" rsync -av --delete \
    --exclude='.env' --exclude='__pycache__' --exclude='.DS_Store' \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "${LOCAL_DIR}/" "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"
  echo "→ Rebuilding container …"
  sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=accept-new \
    "${VPS_USER}@${VPS_HOST}" \
    "cd ${REMOTE_DIR} && docker compose up -d --build"
else
  # Hot-deploy templates + assets only.
  sshpass -p "$VPS_PASSWORD" rsync -av --delete \
    --exclude='__pycache__' --exclude='.DS_Store' \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "${LOCAL_DIR}/templates/" "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/templates/"
  sshpass -p "$VPS_PASSWORD" rsync -av \
    --exclude='__pycache__' --exclude='.DS_Store' \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "${LOCAL_DIR}/assets/" "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/assets/"
  echo "→ Templates + assets deployed (no rebuild)."
fi

echo "→ Healthcheck …"
HEALTH=$(curl -sS --max-time 15 https://pdf.lichtengross.funk.solutions/healthz)
echo "  $HEALTH"
echo "→ Done."
