import matter from "gray-matter";
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "../lib/config.js";
import { slugFromFilename, postFilename } from "../lib/jekyll.js";

export interface PostMeta {
  filename: string;
  slug: string;
  title: string;
  date: string;
  categories: string[];
  tags: string[];
  layout: string;
  status: "published" | "draft";
  path: string;
  lastModified: string;
}

export interface Post extends PostMeta {
  body: string;
  raw: string;
}

function parseDate(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return new Date().toISOString();
}

function ensureArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

function parseFrontMatter(raw: string, filePath: string, isDraft: boolean): Post {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return {
    filename: filePath.split("/").pop()!,
    slug: slugFromFilename(filePath.split("/").pop()!),
    title: String(data.title ?? ""),
    date: parseDate(data.date),
    categories: ensureArray(data.categories),
    tags: ensureArray(data.tags ?? data.tag),
    layout: String(data.layout ?? "post"),
    status: isDraft ? "draft" : "published",
    path: filePath,
    lastModified: statSync(filePath).mtime.toISOString(),
    body: parsed.content,
    raw,
  };
}

function readPostFile(filePath: string, isDraft: boolean): Post {
  const raw = readFileSync(filePath, "utf-8");
  return parseFrontMatter(raw, filePath, isDraft);
}

export function readPost(slug: string): Post {
  for (const dir of [config.postsDir, config.draftsDir]) {
    const dirPath = join(config.repoPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath)) {
      if (entry.endsWith(".md") && slugFromFilename(entry) === slug) {
        return readPostFile(join(dirPath, entry), dir === config.draftsDir);
      }
    }
  }
  throw new Error(`Post not found: ${slug}`);
}

export function listPosts(filters?: {
  status?: "published" | "draft" | "all";
  category?: string;
  tag?: string;
  query?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}): PostMeta[] {
  const results: PostMeta[] = [];
  const dirs: { dir: string; status: "published" | "draft" }[] = [];

  if (!filters?.status || filters.status === "all" || filters.status === "published") {
    dirs.push({ dir: config.postsDir, status: "published" });
  }
  if (!filters?.status || filters.status === "all" || filters.status === "draft") {
    dirs.push({ dir: config.draftsDir, status: "draft" });
  }

  for (const { dir, status } of dirs) {
    const dirPath = join(config.repoPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath)) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(dirPath, entry);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;

      const meta: PostMeta = {
        filename: entry,
        slug: slugFromFilename(entry),
        title: String(data.title ?? ""),
        date: parseDate(data.date),
        categories: ensureArray(data.categories),
        tags: ensureArray(data.tags ?? data.tag),
        layout: String(data.layout ?? "post"),
        status,
        path: filePath,
        lastModified: statSync(filePath).mtime.toISOString(),
      };

      if (filters?.category && !meta.categories.includes(filters.category)) continue;
      if (filters?.tag && !meta.tags.includes(filters.tag)) continue;
      if (filters?.fromDate && meta.date < filters.fromDate) continue;
      if (filters?.toDate && meta.date > filters.toDate) continue;
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        if (
          !meta.title.toLowerCase().includes(q) &&
          !parsed.content.toLowerCase().includes(q)
        )
          continue;
      }

      results.push(meta);
    }
  }

  results.sort((a, b) => b.date.localeCompare(a.date));

  const offset = filters?.offset ?? 0;
  const limit = filters?.limit;
  return limit ? results.slice(offset, offset + limit) : results.slice(offset);
}

export function searchPosts(query: string, scope: "title" | "body" | "metadata" | "all" = "all", status: "published" | "draft" | "all" = "all"): { post: PostMeta; snippet: string }[] {
  const results: { post: PostMeta; snippet: string }[] = [];
  const q = query.toLowerCase();
  const dirs: { dir: string; status: "published" | "draft" }[] = [];

  if (status === "all" || status === "published") dirs.push({ dir: config.postsDir, status: "published" });
  if (status === "all" || status === "draft") dirs.push({ dir: config.draftsDir, status: "draft" });

  for (const { dir, status: st } of dirs) {
    const dirPath = join(config.repoPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath)) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(dirPath, entry);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;

      const meta: PostMeta = {
        filename: entry,
        slug: slugFromFilename(entry),
        title: String(data.title ?? ""),
        date: parseDate(data.date),
        categories: ensureArray(data.categories),
        tags: ensureArray(data.tags ?? data.tag),
        layout: String(data.layout ?? "post"),
        status: st,
        path: filePath,
        lastModified: statSync(filePath).mtime.toISOString(),
      };

      let matched = false;
      let snippet = "";

      if ((scope === "all" || scope === "title") && meta.title.toLowerCase().includes(q)) {
        matched = true;
        snippet = `Title: ${meta.title}`;
      }
      if ((scope === "all" || scope === "body") && parsed.content.toLowerCase().includes(q)) {
        matched = true;
        const idx = parsed.content.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 40);
        const end = Math.min(parsed.content.length, idx + q.length + 40);
        snippet = `...${parsed.content.slice(start, end)}...`;
      }
      if ((scope === "all" || scope === "metadata") &&
        (meta.categories.some(c => c.toLowerCase().includes(q)) ||
         meta.tags.some(t => t.toLowerCase().includes(q)))) {
        matched = true;
        snippet = `Categories: ${meta.categories.join(", ")} | Tags: ${meta.tags.join(", ")}`;
      }

      if (!matched) continue;

      results.push({ post: meta, snippet });
    }
  }

  results.sort((a, b) => {
    const aTitle = a.post.title.toLowerCase().indexOf(q) !== -1 ? 0 : 1;
    const bTitle = b.post.title.toLowerCase().indexOf(q) !== -1 ? 0 : 1;
    return aTitle - bTitle || b.post.date.localeCompare(a.post.date);
  });

  return results;
}

export function getCategories(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const dir of [config.postsDir, config.draftsDir]) {
    const dirPath = join(config.repoPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath)) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(dirPath, entry);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      const cats = ensureArray((parsed.data as Record<string, unknown>).categories);
      for (const c of cats) {
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getTags(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const dir of [config.postsDir, config.draftsDir]) {
    const dirPath = join(config.repoPath, dir);
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath)) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(dirPath, entry);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      const tags = ensureArray((parsed.data as Record<string, unknown>).tags ?? (parsed.data as Record<string, unknown>).tag);
      for (const t of tags) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function writePostFile(slug: string, status: "published" | "draft", frontMatter: Record<string, unknown>, body: string): string {
  const dir = status === "draft" ? config.draftsDir : config.postsDir;
  const dirPath = join(config.repoPath, dir);
  mkdirSync(dirPath, { recursive: true });

  const date = frontMatter.date
    ? new Date(frontMatter.date as string).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const filename = status === "published"
    ? `${date}-${slug}.md`
    : `${slug}.md`;

  const filePath = join(dirPath, filename);
  const fm = { ...frontMatter, layout: "post" };
  const content = matter.stringify(body, fm);
  writeFileSync(filePath, content);
  return filePath;
}

export function movePost(slug: string, fromStatus: "published" | "draft", toStatus: "published" | "draft"): { oldPath: string; newPath: string } {
  const fromDir = fromStatus === "draft" ? config.draftsDir : config.postsDir;
  const toDir = toStatus === "draft" ? config.draftsDir : config.postsDir;
  const fromPath = join(config.repoPath, fromDir);

  for (const entry of readdirSync(fromPath)) {
    if (!entry.endsWith(".md")) continue;
    if (slugFromFilename(entry) !== slug) continue;

    const oldPath = join(fromPath, entry);
    const post = readPostFile(oldPath, fromStatus === "draft");

    mkdirSync(join(config.repoPath, toDir), { recursive: true });

    const newFilename = toStatus === "published"
      ? postFilename(post.date, slug)
      : `${slug}.md`;

    const newPath = join(config.repoPath, toDir, newFilename);

    const fm: Record<string, unknown> = {
      layout: "post",
      title: post.title,
      date: post.date,
      categories: post.categories,
    };
    if (post.tags.length > 0) fm.tags = post.tags;

    const content = matter.stringify(post.body, fm);
    writeFileSync(newPath, content);
    unlinkSync(oldPath);

    return { oldPath, newPath };
  }

  throw new Error(`Post not found: ${slug}`);
}