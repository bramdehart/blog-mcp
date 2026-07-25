#!/usr/bin/env bash
set -euo pipefail

# One-time VPS setup. Reads from environment or .env.setup:
#   SETUP_HOST / SETUP_USER / SETUP_PATH / MCP_API_KEY
#   GIT_REPO_PATH   — where to clone the blog repo
#   BLOG_REPO_URL   — git URL of the Jekyll blog repo (e.g. git@github.com:user/blog.git)
#   GIT_BRANCH      — branch to use (default: main)

: "${SETUP_HOST:?Set SETUP_HOST}"
: "${SETUP_USER:?Set SETUP_USER}"
: "${SETUP_PATH:?Set SETUP_PATH}"
: "${BLOG_REPO_URL:?Set BLOG_REPO_URL}"

GIT_REPO_PATH="${GIT_REPO_PATH:-${SETUP_PATH}/blog-repo}"
GIT_BRANCH="${GIT_BRANCH:-main}"
MCP_API_KEY="${MCP_API_KEY:-$(openssl rand -hex 32)}"

echo "=== Creating directories ==="
ssh "${SETUP_USER}@${SETUP_HOST}" bash -s <<ENDSSH
set -euo pipefail
mkdir -p "${SETUP_PATH}" "${GIT_REPO_PATH}"
ENDSSH

echo "=== Cloning blog repo ==="
ssh "${SETUP_USER}@${SETUP_HOST}" \
  "git clone --branch ${GIT_BRANCH} '${BLOG_REPO_URL}' '${GIT_REPO_PATH}' || echo 'Repo already exists, skipping clone'"

echo "=== Creating .env ==="
ssh "${SETUP_USER}@${SETUP_HOST}" bash -s <<ENDSSH
set -euo pipefail
cat > "${SETUP_PATH}/.env" <<EOF
MCP_API_KEY=${MCP_API_KEY}
GIT_REPO_PATH=${GIT_REPO_PATH}
GIT_BRANCH=${GIT_BRANCH}
GIT_USER_NAME=Jekyll MCP
GIT_USER_EMAIL=mcp@example.com
MCP_BIND_HOST=127.0.0.1
MCP_BIND_PORT=3000
EOF
ENDSSH

echo "=== Installing systemd service ==="
scp scripts/systemd/blog-mcp.service "${SETUP_USER}@${SETUP_HOST}:/tmp/blog-mcp.service"
ssh "${SETUP_USER}@${SETUP_HOST}" bash -s <<ENDSSH
set -euo pipefail
sudo mv /tmp/blog-mcp.service /etc/systemd/system/blog-mcp.service
sudo systemctl daemon-reload
sudo systemctl enable blog-mcp
ENDSSH

echo "=== Generated API key (save this!) ==="
echo "${MCP_API_KEY}"

echo "=== Setup complete ==="
echo "Review ${SETUP_PATH}/.env on the VPS and adjust if needed."
echo "Then run: ssh ${SETUP_USER}@${SETUP_HOST} sudo systemctl start blog-mcp"