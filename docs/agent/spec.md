# MCP Specification — Jekyll Blog Manager

## Overview

Build an MCP server for managing a Jekyll blog stored in a GitHub repository.
The server must support collaboration between a single authenticated user and an LLM to create, edit, draft, publish, unpublish, search, list, and manage blog posts and images.

The blog is a standard Jekyll site using Markdown posts in `_posts/` and image assets stored in the repository.

---

## Repository Conventions

- `_posts/` for published posts
- `_drafts/` for unpublished posts and unfinished work
- `assets/images/` for uploaded images

If a different structure is used, it must still support draft persistence, later publication, and image references inside posts.

---

## Jekyll Requirements

### Required front matter

```yaml
---
layout: post
title: "This is a test"
date: 2026-07-25 12:33:27 +0200
categories: test
---
This is the article
```

### Rules

- `layout` must always be `post`
- `title` is required
- `date` is required
- `categories` must be supported
- `tags` should be supported if present in the repo
- filenames must follow Jekyll naming conventions
- markdown content must remain valid
- front matter must remain valid YAML

### Filename format

Published posts: `YYYY-MM-DD-title-slug.md`

Example: `2026-07-25-this-is-a-test.md`

---

## Functional Requirements

### 1. Read posts

Read and parse posts from `_posts/`.

Return: filename, slug, title, date, categories, tags, layout, body content, publication status, and metadata needed for editing.

### 2. List posts

List posts with optional filters: status (published/draft/all), category, tag, date range, text query, slug, filename.

Result should include enough metadata to identify and open a post.

### 3. Search posts

Case-insensitive search across titles, body content, categories, tags, front matter, and filenames.

### 4. Categories and tags

Extract unique categories and tags from existing posts. Provide suggestions based on frequency, topic similarity, and existing writing patterns.

### 5. Create posts collaboratively

Accept a topic or rough idea, suggest a title and categories, generate front matter and content, save as draft or publish-ready post. Allow interactive refinement.

### 6. Edit posts

Edit title, body, date, categories, tags, filename/slug, and front matter fields. Preserve valid Jekyll formatting. Detect conflicts and avoid accidental overwrites.

### 7. Publish and unpublish

- Publish a draft into `_posts/`
- Unpublish a post back into `_drafts/`
- Preserve metadata during transitions
- Ensure final filename and front matter follow Jekyll rules

### 8. Upload images

Accept uploaded image files, store in `assets/images/`, return the image path and a Markdown reference (`![Alt text](/assets/images/example.png)`). Support alt text.

### 9. Attach images to posts

Insert image references into post content. Optionally support captions, Jekyll includes, and gallery-style embeds.

### 10. Push changes to GitHub

Stage changes, create a commit following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification), push to the configured branch. Report failures clearly. Avoid pushing in conflicted or unsafe states.

---

## Draft / Memory Model

Unfinished content must persist in the repository, not in memory.

Recommended approach:
- Use `_drafts/` for unfinished posts
- Allow reopening drafts later (recoverable from disk and git history)
- Preserve draft content across restarts

---

## Authentication

Single-user protection via API key or bearer token.

Rules:
- Reject unauthorized requests
- Never log tokens or secrets
- Store secrets securely
- Auth is mandatory for all tools

---

## Safety Requirements

Prevent:
- Path traversal and unauthorized file access
- Accidental deletion or overwrite
- Malformed front matter and invalid filenames

Destructive operations require confirmation. The server must never operate outside the blog repository.

---

## MCP Tool Requirements

The server must expose tools for: list, read, search, categories, tags, create, edit, publish, unpublish, draft save/resume, image upload, image attachment, git status, and git push. See `tools.md` for detailed tool signatures.

---

## Post Creation Workflow

1. User provides topic or rough idea
2. MCP server inspects existing posts/categories/tags
3. MCP server suggests title and categories
4. LLM drafts content
5. User reviews and adjusts
6. Post is saved as draft or published
7. Changes are committed and pushed to GitHub

---

## Validation Rules

Validate:
- YAML front matter syntax
- Required Jekyll fields
- Markdown file structure
- Allowed image paths
- Safe slugs and filenames
- Date format compatibility

Normalize data where sensible.

---

## Optional Enhancements

If feasible: preview rendering, duplicate title detection, automatic slug generation, category/tag normalization, markdown linting, commit message auto-generation (following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification)), post rename, safe delete with confirmation, local render/test endpoint, image optimization.