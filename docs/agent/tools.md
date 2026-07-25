# MCP Tools — Jekyll Blog Manager

This document defines the MCP tools required for managing a Jekyll blog stored in a GitHub repository. See `spec.md` for the full requirements.

---

## General Tool Principles

All tools must:

- require authentication
- operate only on the configured blog repository
- validate file paths and filenames
- return clear errors
- avoid unsafe overwrites unless explicitly confirmed
- preserve Jekyll compatibility

Tool responses should be structured, predictable, and easy for an LLM to use.

---

## Tool Set

### 1. `list_posts`

List posts and drafts with optional filters.

#### Inputs
- `status` (optional): `published | draft | all`
- `category` (optional)
- `tag` (optional)
- `query` (optional text search)
- `from_date` (optional)
- `to_date` (optional)
- `limit` (optional)
- `offset` (optional)

#### Returns
- list of matching posts
- filename
- slug
- title
- date
- categories
- tags
- status
- short excerpt

---

### 2. `read_post`

Read a single post or draft.

#### Inputs
- `path` or `filename`
- or `slug`

#### Returns
- full front matter
- body content
- metadata
- status
- file path
- last modified time

---

### 3. `search_posts`

Search posts, drafts, and metadata.

#### Inputs
- `query`
- `scope` (optional): `title | body | metadata | all`
- `status` (optional): `published | draft | all`

#### Returns
- ranked matches
- matching snippets
- relevance hints
- file references

---

### 4. `get_categories`

Return all unique categories used in the repository.

#### Inputs
- none

#### Returns
- list of categories
- usage counts
- optional example posts

---

### 5. `get_tags`

Return all unique tags used in the repository.

#### Inputs
- none

#### Returns
- list of tags
- usage counts
- optional example posts

---

### 6. `suggest_title`

Suggest one or more titles for a post.

#### Inputs
- `topic`
- `tone` (optional)
- `audience` (optional)
- `length` (optional)
- `style_reference` (optional)

#### Returns
- candidate titles
- confidence or rationale if available

---

### 7. `suggest_categories`

Suggest categories for a post.

#### Inputs
- `topic`
- `draft_body` (optional)
- `existing_categories` (optional override)

#### Returns
- suggested categories
- explanation or similarity hints

---

### 8. `suggest_tags`

Suggest tags for a post.

#### Inputs
- `topic`
- `draft_body` (optional)
- `existing_tags` (optional override)

#### Returns
- suggested tags
- explanation or similarity hints

---

### 9. `create_post`

Create a new post or draft.

#### Inputs
- `title`
- `body`
- `date` (optional, defaults to now)
- `categories` (optional)
- `tags` (optional)
- `layout` (must default to `post`)
- `status` (`draft | published`)
- `slug` (optional)
- `filename` (optional)
- `save_mode` (optional, e.g. `draft` or `publish-ready`)

#### Behavior
- generate valid Jekyll front matter
- create the appropriate file in `_drafts/` or `_posts/`
- auto-generate slug/filename if missing

#### Returns
- created file path
- metadata
- preview of resulting content

---

### 10. `edit_post`

Edit an existing post or draft.

#### Inputs
- `path` or `filename`
- `title` (optional)
- `body` (optional)
- `date` (optional)
- `categories` (optional)
- `tags` (optional)
- `slug` (optional)
- `status` (optional)
- `replace_body` (optional boolean)
- `expected_last_modified` (optional, for conflict detection)

#### Behavior
- preserve or update front matter as needed
- detect conflicts when the file changed since it was loaded

#### Returns
- updated file path
- summary of changes

---

### 11. `publish_post`

Publish a draft or unpublished post.

#### Inputs
- `path` or `filename` or `slug`
- `date` (optional, if the post needs renaming)
- `confirm` (required for destructive move/rename if applicable)

#### Behavior
- move content into `_posts/`
- ensure filename follows Jekyll rules
- ensure layout is `post`
- preserve content and metadata

#### Returns
- new published file path
- publish status

---

### 12. `unpublish_post`

Unpublish a post and move it back to drafts.

#### Inputs
- `path` or `filename` or `slug`
- `confirm`

#### Behavior
- move post from `_posts/` to `_drafts/`
- preserve metadata and content
- keep draft state recoverable

#### Returns
- new draft file path
- status

---

### 13. `save_draft`

Save or update a draft.

#### Inputs
- `title`
- `body`
- `categories` (optional)
- `tags` (optional)
- `slug` (optional)
- `date` (optional)
- `draft_id` (optional)

#### Behavior
- create or update a draft in `_drafts/`

#### Returns
- draft file path
- draft identifier
- current metadata

---

### 14. `resume_draft`

Load an unfinished draft for continuation.

#### Inputs
- `path` or `filename` or `slug`

#### Returns
- current draft content
- metadata
- status
- last modified time

---

### 15. `upload_image`

Upload an image to the repository.

#### Inputs
- `filename`
- `content` or binary payload
- `alt` (optional)
- `folder` (optional, default `assets/images/`)
- `overwrite` (optional boolean)

#### Behavior
- validate image type
- store in repo
- return markdown reference and path

#### Returns
- image path
- public reference
- suggested markdown snippet

---

### 16. `attach_image_to_post`

Insert an image reference into a post.

#### Inputs
- `post_path` or `slug`
- `image_path`
- `alt` (optional)
- `position` (optional)
- `caption` (optional)

#### Behavior
- insert markdown image syntax or a supported Jekyll include
- preserve formatting

#### Returns
- updated post content summary
- inserted snippet

---

### 17. `git_status`

Return the current git repository state.

#### Inputs
- none

#### Returns
- branch
- clean/dirty state
- changed files
- untracked files
- last commit hash
- remote status if available

---

### 18. `push_changes`

Commit and push changes to GitHub. Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification) standard (`feat:`, `fix:`, `docs:`, `chore:`, etc.).

#### Inputs
- `commit_message` (optional; auto-generated if not provided, following Conventional Commits)
- `branch` (optional)
- `force` (should default to false and usually disallowed)
- `confirm` (optional if required by implementation)

#### Behavior
- stage changes
- create a commit
- push to remote repository
- report failures clearly

#### Returns
- commit hash
- push result
- remote branch status

---

## Optional Tools

These are not strictly required but highly recommended.

### `delete_post`
Delete a post or draft. Require explicit confirmation.

### `rename_post`
Rename a post and update filename/slug safely.

### `preview_post`
Return rendered or preview-friendly output.

### `detect_duplicates`
Detect duplicate titles, slugs, categories, or tags.

### `list_images`
List uploaded images and their paths.

### `remove_image`
Delete an image file with confirmation.

### `repo_health`
Check whether the repository is in a safe state for editing or pushing.

---

## Tool Design Guidelines

### Inputs
- Prefer simple, explicit arguments
- Use `slug`, `filename`, or `path` consistently
- Support `confirm` for dangerous actions

### Outputs
Each tool should return:
- `success`
- `message`
- `data`
- `warnings` if needed
- `error` if failed

### Conflict handling
When editing or publishing:
- compare expected file state with actual state
- reject or warn on conflicts
- avoid silent overwrites

### Jekyll compliance
All write operations must ensure:
- valid YAML front matter
- `layout: post`
- compatible date formatting
- safe filenames