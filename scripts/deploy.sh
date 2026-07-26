#!/usr/bin/env bash
set -euo pipefail

# Reads from environment variables (set locally via .env.deploy or via GitHub Secrets in CI):
#   DEPLOY_HOST        — VPS hostname
#   DEPLOY_USER        — SSH user
#   DEPLOY_PATH        — Remote app directory, e.g. /opt/apps/blog-mcp
#   SSH_PRIVATE_KEY    — SSH private key (only needed in CI; locally uses your default key)

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH}"

if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
  echo "=== Setting up SSH (CI) ==="
  mkdir -p ~/.ssh
  echo "${SSH_PRIVATE_KEY}" > ~/.ssh/id_rsa
  chmod 600 ~/.ssh/id_rsa
  ssh-keyscan -H "${DEPLOY_HOST}" >> ~/.ssh/known_hosts 2>/dev/null
fi

echo "=== Building ==="
npm ci
npm run build

echo "=== Syncing files ==="
rsync -avz --delete dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/dist/"
rsync -avz package.json package-lock.json "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "=== Installing on VPS ==="
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<ENDSSH
set -euo pipefail
cd "${DEPLOY_PATH}"
npm ci --omit=dev
ENDSSH

echo "=== Restarting service ==="
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "sudo systemctl restart blog-mcp"

echo "=== Done ==="