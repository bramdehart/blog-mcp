# Deployment — Jekyll Blog MCP Server

## Goal
Run an MCP server on a VPS behind Caddy to manage a Jekyll blog repo with a single API key.

## Stack
- VPS (Linux)
- MCP server app
- Local git clone of the Jekyll repo
- Caddy reverse proxy
- GitHub push access via SSH deploy key or PAT

## Environment Variables
```env
MCP_API_KEY=your-secret-key
GIT_REPO_PATH=/opt/jekyll-mcp/repo
GIT_BRANCH=main
GIT_USER_NAME=Jekyll MCP
GIT_USER_EMAIL=mcp@example.com
MCP_BIND_HOST=127.0.0.1
MCP_BIND_PORT=3000
```

## Setup Steps
1. Create a dedicated Linux user
2. Clone the Jekyll repo locally
3. Install the MCP server runtime
4. Configure the environment variables
5. Ensure git push access to GitHub
6. Run the MCP server as a systemd service
7. Put Caddy in front as reverse proxy

## Caddy Configuration
```caddyfile
mcp.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

## systemd Service
```ini
[Unit]
Description=Jekyll MCP Server
After=network.target

[Service]
Type=simple
User=blog-mcp
WorkingDirectory=/opt/jekyll-mcp/app
EnvironmentFile=/opt/jekyll-mcp/.env
ExecStart=/usr/bin/node /opt/jekyll-mcp/app/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Security
- Bind backend only to localhost — never expose the MCP port publicly
- Require `Authorization: Bearer <API_KEY>` on all requests
- Validate all file paths and prevent path traversal
- Require confirmation for destructive actions
- Do not log secrets

## Git Strategy
- Commit changes locally using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification) format (`feat:`, `fix:`, `docs:`, `chore:`, etc.)
- Push to GitHub after successful validation
- Avoid force push unless explicitly required

## Operational Rule
The server must only operate inside the configured repository and only for the authenticated user.