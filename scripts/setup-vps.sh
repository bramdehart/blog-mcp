#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH}"
: "${BLOG_REPO_URL:?Set BLOG_REPO_URL}"

if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
  echo "=== Setting up SSH (CI) ==="
  mkdir -p ~/.ssh
  echo "${SSH_PRIVATE_KEY}" > ~/.ssh/id_rsa
  chmod 600 ~/.ssh/id_rsa
  ssh-keyscan -H "${DEPLOY_HOST}" >> ~/.ssh/known_hosts 2>/dev/null
fi

GIT_REPO_PATH="${GIT_REPO_PATH:-${DEPLOY_PATH}/blog-repo}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo "=== Creating directories ==="
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<ENDSSH
set -euo pipefail
mkdir -p "${DEPLOY_PATH}" "${GIT_REPO_PATH}"
ENDSSH

echo "=== Cloning blog repo ==="
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "git clone --branch ${GIT_BRANCH} '${BLOG_REPO_URL}' '${GIT_REPO_PATH}' || echo 'Repo already exists, skipping clone'"

echo "=== Creating .env ==="
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<ENDSSH
set -euo pipefail
API_KEY=\$(openssl rand -hex 32)
cat > "${DEPLOY_PATH}/.env" <<ENVEOF
MCP_API_KEY=\${API_KEY}
GIT_REPO_PATH=${GIT_REPO_PATH}
GIT_BRANCH=${GIT_BRANCH}
GIT_USER_NAME=Jekyll MCP
GIT_USER_EMAIL=mcp@example.com
MCP_BIND_HOST=127.0.0.1
MCP_BIND_PORT=3000
ENVEOF
ENDSSH

echo ""
echo "=== Setup complete ==="
echo "Your API key is stored in ${DEPLOY_PATH}/.env on the VPS."
echo "Run: ssh ${DEPLOY_USER}@${DEPLOY_HOST} grep MCP_API_KEY ${DEPLOY_PATH}/.env"
echo ""
echo "Manual steps (run on VPS, order matters):"
echo ""
echo "  # As root: install Node.js 22"
echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
echo "  sudo apt-get install -y nodejs"
echo ""
echo "  # As root: install and start the systemd service"
echo "  sudo mv /tmp/blog-mcp.service /etc/systemd/system/blog-mcp.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable blog-mcp"
echo "  sudo systemctl start blog-mcp"
echo ""
echo "  # As root: allow ${DEPLOY_USER} to restart the service (for deploy.sh)"
echo "  echo '${DEPLOY_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart blog-mcp' | sudo tee /etc/sudoers.d/blog-mcp"
echo ""
echo "  # As ${DEPLOY_USER}: verify Node.js"
echo "  node --version && npm --version"