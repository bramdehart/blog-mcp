import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { simpleGit } from "simple-git";
import matter from "gray-matter";
import { config } from "./lib/config.js";
import { requireApiKey } from "./lib/auth.js";
import { slugify } from "./lib/jekyll.js";
import {
  listPosts,
  readPost,
  searchPosts,
  getCategories,
  getTags,
  writePostFile,
  movePost,
} from "./lib/posts.js";
import type { PostMeta } from "./lib/posts.js";

function formatMeta(p: PostMeta) {
  return {
    filename: p.filename,
    slug: p.slug,
    title: p.title,
    date: p.date,
    categories: p.categories,
    tags: p.tags,
    status: p.status,
    lastModified: p.lastModified,
  };
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: "blog-mcp", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  // --- list_posts ---
  server.registerTool("list_posts", {
    description: "List posts and drafts with optional filters.",
    inputSchema: {
      status: z.enum(["published", "draft", "all"]).optional().describe("Filter by publication status"),
      category: z.string().optional().describe("Filter by category"),
      tag: z.string().optional().describe("Filter by tag"),
      query: z.string().optional().describe("Text search in title and body"),
      fromDate: z.string().optional().describe("Filter posts on or after this date (YYYY-MM-DD)"),
      toDate: z.string().optional().describe("Filter posts on or before this date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Maximum number of results"),
      offset: z.number().optional().describe("Number of results to skip"),
    },
  }, async (args) => {
    const posts = listPosts({
      status: args.status as "published" | "draft" | "all" | undefined,
      category: args.category,
      tag: args.tag,
      query: args.query,
      fromDate: args.fromDate,
      toDate: args.toDate,
      limit: args.limit,
      offset: args.offset,
    });
    return { content: [{ type: "text", text: JSON.stringify(posts.map(formatMeta), null, 2) }] };
  });

  // --- read_post ---
  server.registerTool("read_post", {
    description: "Read a single post or draft by slug.",
    inputSchema: {
      slug: z.string().describe("The post slug (filename without date prefix and .md extension)"),
    },
  }, async ({ slug }) => {
    const post = readPost(slug);
    return { content: [{ type: "text", text: JSON.stringify({ ...formatMeta(post), body: post.body }, null, 2) }] };
  });

  // --- search_posts ---
  server.registerTool("search_posts", {
    description: "Search posts, drafts, and metadata.",
    inputSchema: {
      query: z.string().describe("Search query"),
      scope: z.enum(["title", "body", "metadata", "all"]).optional().describe("Search scope"),
      status: z.enum(["published", "draft", "all"]).optional().describe("Filter by publication status"),
    },
  }, async (args) => {
    const results = searchPosts(args.query, args.scope, args.status);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  });

  // --- get_categories ---
  server.registerTool("get_categories", {
    description: "Return all unique categories used in the repository with usage counts.",
  }, async () => {
    const categories = getCategories();
    return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }] };
  });

  // --- get_tags ---
  server.registerTool("get_tags", {
    description: "Return all unique tags used in the repository with usage counts.",
  }, async () => {
    const tags = getTags();
    return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
  });

  // --- suggest_title ---
  server.registerTool("suggest_title", {
    description: "Returns existing post titles and patterns to help the LLM suggest a title.",
    inputSchema: {
      topic: z.string().describe("The topic to suggest a title for"),
    },
  }, async ({ topic }) => {
    const allPosts = listPosts();
    const titles = allPosts.map(p => p.title);
    const categories = getCategories();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ topic, existingTitles: titles, existingCategories: categories }, null, 2),
      }],
    };
  });

  // --- suggest_categories ---
  server.registerTool("suggest_categories", {
    description: "Returns existing categories and related posts to help the LLM suggest categories.",
    inputSchema: {
      topic: z.string().describe("The topic of the post"),
      draftBody: z.string().optional().describe("Optional draft body content for context"),
    },
  }, async ({ topic, draftBody }) => {
    const categories = getCategories();
    const allPosts = listPosts();
    const relatedPosts = allPosts.filter(p =>
      p.title.toLowerCase().includes(topic.toLowerCase())
    ).slice(0, 5);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          topic,
          existingCategories: categories,
          relatedPosts: relatedPosts.map(p => ({ title: p.title, categories: p.categories, tags: p.tags })),
        }, null, 2),
      }],
    };
  });

  // --- suggest_tags ---
  server.registerTool("suggest_tags", {
    description: "Returns existing tags and related posts to help the LLM suggest tags.",
    inputSchema: {
      topic: z.string().describe("The topic of the post"),
      draftBody: z.string().optional().describe("Optional draft body content for context"),
    },
  }, async ({ topic, draftBody }) => {
    const tags = getTags();
    const allPosts = listPosts();
    const relatedPosts = allPosts.filter(p =>
      p.title.toLowerCase().includes(topic.toLowerCase())
    ).slice(0, 5);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          topic,
          existingTags: tags,
          relatedPosts: relatedPosts.map(p => ({ title: p.title, categories: p.categories, tags: p.tags })),
        }, null, 2),
      }],
    };
  });

  // --- create_post ---
  server.registerTool("create_post", {
    description: "Create a new post or draft.",
    inputSchema: {
      title: z.string().describe("Post title"),
      body: z.string().describe("Post body (Markdown)"),
      date: z.string().optional().describe("Publication date (defaults to now)"),
      categories: z.array(z.string()).optional().describe("Categories"),
      tags: z.array(z.string()).optional().describe("Tags"),
      status: z.enum(["draft", "published"]).describe("Save as draft or publish immediately"),
      slug: z.string().optional().describe("Custom slug (auto-generated from title if omitted)"),
    },
  }, async ({ title, body, date, categories, tags, status, slug }) => {
    const s = slug ?? slugify(title);
    const filePath = writePostFile(s, status, {
      title,
      date: date ?? new Date().toISOString(),
      categories: categories ?? [],
      tags: tags ?? [],
    }, body);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ slug: s, status, path: filePath }, null, 2),
      }],
    };
  });

  // --- edit_post ---
  server.registerTool("edit_post", {
    description: "Edit an existing post or draft.",
    inputSchema: {
      slug: z.string().describe("The post slug to edit"),
      title: z.string().optional().describe("New title"),
      body: z.string().optional().describe("New body (replaces entire body)"),
      date: z.string().optional().describe("New date"),
      categories: z.array(z.string()).optional().describe("New categories"),
      tags: z.array(z.string()).optional().describe("New tags"),
      status: z.enum(["draft", "published"]).optional().describe("New status"),
    },
  }, async ({ slug, title, body, date, categories, tags, status }) => {
    const post = readPost(slug);
    const updated = matter.stringify(
      body ?? post.body,
      {
        layout: "post",
        title: title ?? post.title,
        date: date ?? post.date,
        categories: categories ?? post.categories,
        tags: tags ?? post.tags,
      }
    );
    writeFileSync(post.path, updated);

    if (status && status !== post.status) {
      const result = movePost(slug, post.status, status);
      return {
        content: [{ type: "text", text: JSON.stringify({ slug, status, path: result.newPath }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ slug, status: post.status, path: post.path }, null, 2) }],
    };
  });

  // --- save_draft ---
  server.registerTool("save_draft", {
    description: "Save or update a draft.",
    inputSchema: {
      title: z.string().describe("Draft title"),
      body: z.string().describe("Draft body (Markdown)"),
      categories: z.array(z.string()).optional().describe("Categories"),
      tags: z.array(z.string()).optional().describe("Tags"),
      slug: z.string().optional().describe("Custom slug (auto-generated from title if omitted)"),
      date: z.string().optional().describe("Date"),
    },
  }, async ({ title, body, categories, tags, slug, date }) => {
    const s = slug ?? slugify(title);
    const dirPath = join(config.repoPath, config.draftsDir);
    mkdirSync(dirPath, { recursive: true });
    const filename = `${s}.md`;
    const filePath = join(dirPath, filename);

    const existingDrafts = listPosts({ status: "draft" });
    const existing = existingDrafts.find(p => p.slug === s);

    const fm: Record<string, unknown> = {
      layout: "post",
      title,
      date: date ?? new Date().toISOString().slice(0, 10),
      categories: categories ?? (existing?.categories ?? []),
      tags: tags ?? (existing?.tags ?? []),
    };

    writePostFile(s, "draft", fm, body);

    return {
      content: [{ type: "text", text: JSON.stringify({ slug: s, status: "draft", path: filePath }, null, 2) }],
    };
  });

  // --- resume_draft ---
  server.registerTool("resume_draft", {
    description: "Load an unfinished draft for continuation.",
    inputSchema: {
      slug: z.string().describe("The draft slug to resume"),
    },
  }, async ({ slug }) => {
    const drafts = listPosts({ status: "draft" });
    const draft = drafts.find(p => p.slug === slug);
    if (!draft) throw new Error(`Draft not found: ${slug}`);
    const post = readPost(slug);
    return {
      content: [{ type: "text", text: JSON.stringify({ ...formatMeta(post), body: post.body }, null, 2) }],
    };
  });

  // --- publish_post ---
  server.registerTool("publish_post", {
    description: "Publish a draft or unpublished post.",
    inputSchema: {
      slug: z.string().describe("The post slug to publish"),
      date: z.string().optional().describe("Publication date (defaults to now)"),
    },
  }, async ({ slug, date }) => {
    const post = readPost(slug);
    if (post.status === "published") {
      return { content: [{ type: "text", text: `Post '${slug}' is already published.` }] };
    }
    const result = movePost(slug, "draft", "published");
    return {
      content: [{ type: "text", text: JSON.stringify({ slug, status: "published", path: result.newPath }, null, 2) }],
    };
  });

  // --- unpublish_post ---
  server.registerTool("unpublish_post", {
    description: "Unpublish a post and move it back to drafts.",
    inputSchema: {
      slug: z.string().describe("The post slug to unpublish"),
    },
  }, async ({ slug }) => {
    const post = readPost(slug);
    if (post.status === "draft") {
      return { content: [{ type: "text", text: `Post '${slug}' is already a draft.` }] };
    }
    const result = movePost(slug, "published", "draft");
    return {
      content: [{ type: "text", text: JSON.stringify({ slug, status: "draft", path: result.newPath }, null, 2) }],
    };
  });

  // --- upload_image ---
  server.registerTool("upload_image", {
    description: "Upload an image to the repository.",
    inputSchema: {
      filename: z.string().describe("Image filename (e.g., photo.png)"),
      content: z.string().describe("Base64-encoded image content"),
      alt: z.string().optional().describe("Alt text for the image"),
      folder: z.string().optional().describe("Subfolder within assets/images/"),
    },
  }, async ({ filename, content, alt, folder }) => {
    const safeName = basename(filename);
    const imgDir = folder ? join(config.repoPath, config.imagesDir, folder) : join(config.repoPath, config.imagesDir);
    mkdirSync(imgDir, { recursive: true });
    const filePath = join(imgDir, safeName);

    const buffer = Buffer.from(content, "base64");
    writeFileSync(filePath, buffer);

    const publicPath = folder
      ? `/${config.imagesDir}/${folder}/${safeName}`
      : `/${config.imagesDir}/${safeName}`;

    const md = `![${alt ?? safeName}](${publicPath})`;

    return {
      content: [{ type: "text", text: JSON.stringify({ path: publicPath, markdown: md }, null, 2) }],
    };
  });

  // --- attach_image_to_post ---
  server.registerTool("attach_image_to_post", {
    description: "Insert an image reference into a post.",
    inputSchema: {
      postSlug: z.string().describe("The post slug to attach the image to"),
      imagePath: z.string().describe("Image path (e.g., /assets/images/photo.png)"),
      alt: z.string().optional().describe("Alt text for the image"),
      position: z.enum(["start", "end", "append"]).optional().describe("Where to insert the image"),
      caption: z.string().optional().describe("Image caption"),
    },
  }, async ({ postSlug, imagePath, alt, position, caption }) => {
    const post = readPost(postSlug);
    let imgMd = `![${alt ?? ""}](${imagePath})`;
    if (caption) imgMd += `\n*${caption}*`;

    let newBody: string;
    const appendMode = position ?? "end";
    switch (appendMode) {
      case "start":
        newBody = imgMd + "\n\n" + post.body;
        break;
      case "end":
      case "append":
        newBody = post.body + "\n\n" + imgMd;
        break;
      default:
        newBody = post.body + "\n\n" + imgMd;
    }

    const fm: Record<string, unknown> = {
      layout: "post",
      title: post.title,
      date: post.date,
      categories: post.categories,
      tags: post.tags,
    };

    const content = matter.stringify(newBody, fm);
    writeFileSync(post.path, content);

    return {
      content: [{ type: "text", text: JSON.stringify({ slug: postSlug, inserted: imgMd }, null, 2) }],
    };
  });

  // --- git_status ---
  server.registerTool("git_status", {
    description: "Return the current git repository state.",
  }, async () => {
    const git = simpleGit(config.repoPath);
    const status = await git.status();
    const log = await git.log({ maxCount: 1 });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          branch: status.current ?? "unknown",
          clean: status.isClean(),
          changedFiles: [...status.modified, ...status.created, ...status.deleted],
          untrackedFiles: status.not_added,
          lastCommit: log.latest ? { hash: log.latest.hash, message: log.latest.message, date: log.latest.date } : null,
        }, null, 2),
      }],
    };
  });

  // --- push_changes ---
  server.registerTool("push_changes", {
    description: "Commit and push changes to GitHub. Commit messages must follow the Conventional Commits standard (feat:, fix:, docs:, chore:, etc.).",
    inputSchema: {
      commitMessage: z.string().optional().describe("Commit message (auto-generated following Conventional Commits if omitted)"),
      branch: z.string().optional().describe("Branch to push to (defaults to configured branch)"),
      confirm: z.boolean().optional().describe("Confirmation for the push"),
    },
  }, async ({ commitMessage, branch, confirm }) => {
    if (confirm === false) {
      return { content: [{ type: "text", text: "Push cancelled: confirmation required." }] };
    }

    const git = simpleGit(config.repoPath);
    const status = await git.status();

    if (status.isClean()) {
      return { content: [{ type: "text", text: "Nothing to commit. Repository is clean." }] };
    }

    await git.add(".");

    let message = commitMessage;
    if (!message) {
      const modifiedPosts = status.modified.filter(f => f.startsWith("_posts/") || f.startsWith("_drafts/"));
      const newPosts = status.created.filter(f => f.startsWith("_posts/") || f.startsWith("_drafts/"));
      const imageFiles = [...status.modified, ...status.created].filter(f => f.startsWith("assets/images/"));

      const parts: string[] = [];
      if (newPosts.length > 0) parts.push("feat: add " + newPosts.map(f => basename(f)).join(", "));
      else if (modifiedPosts.length > 0) parts.push("fix: update " + modifiedPosts.map(f => basename(f)).join(", "));
      else if (imageFiles.length > 0) parts.push("feat: upload " + imageFiles.map(f => basename(f)).join(", "));
      else parts.push("chore: repository changes");

      message = parts.join("\n") || "chore: repository changes";
    }

    const commitResult = await git.commit(message);
    const targetBranch = branch ?? config.branch;
    await git.push("origin", targetBranch);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          commit: commitResult.commit,
          branch: targetBranch,
          summary: commitResult.summary,
        }, null, 2),
      }],
    };
  });

  return server;
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

const app = createMcpExpressApp({ host: config.bindHost, allowedHosts: [config.publicHost] });

app.post("/mcp", requireApiKey(), async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
      };
      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", requireApiKey(), async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.delete("/mcp", requireApiKey(), async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.listen(config.bindPort, config.bindHost, () => {
  console.log(`Blog MCP server running on ${config.bindHost}:${config.bindPort}`);
});

process.on("SIGINT", async () => {
  for (const sid of Object.keys(transports)) {
    try {
      await transports[sid].close();
    } catch {}
  }
  process.exit(0);
});