import { join, normalize, resolve } from "node:path";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function postFilename(date: string | Date, title: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${slugify(title)}.md`;
}

export function stripDatePrefix(filename: string): string {
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export function slugFromFilename(filename: string): string {
  return stripDatePrefix(filename).replace(/\.md$/, "");
}

export function safeJoin(base: string, ...segments: string[]): string {
  const resolved = resolve(join(base, ...segments));
  if (!resolved.startsWith(resolve(base) + "/") && resolved !== resolve(base)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isValidFilename(filename: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filename);
}