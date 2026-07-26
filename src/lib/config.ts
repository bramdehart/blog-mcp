import { readFileSync } from "node:fs";

function loadEnv(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

const envFile = loadEnv(".env");

function env(key: string, fallback: string): string {
  return process.env[key] || envFile[key] || fallback;
}

export const config = {
  apiKey: env("MCP_API_KEY", ""),
  repoPath: env("GIT_REPO_PATH", process.cwd()),
  branch: env("GIT_BRANCH", "main"),
  gitUserName: env("GIT_USER_NAME", "Jekyll MCP"),
  gitUserEmail: env("GIT_USER_EMAIL", "mcp@example.com"),
  bindHost: env("MCP_BIND_HOST", "127.0.0.1"),
  bindPort: parseInt(env("MCP_BIND_PORT", "3000"), 10),
  publicHost: env("PUBLIC_HOST", "localhost"),
  siteUrl: env("SITE_URL", ""),
  postsDir: "_posts",
  draftsDir: "_drafts",
  imagesDir: "assets/images",
};