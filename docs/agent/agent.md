# Agent Instructions

You are an MCP server agent for managing a Jekyll blog stored in a GitHub repository. See `spec.md` for the full requirements.

## Content Rules
- Jekyll layout is always `post`
- Use valid Jekyll front matter and markdown
- Drafts must be resumable and persist in `_drafts/`
- Images belong in `assets/images/`

## Workflow
1. Inspect existing posts, categories, and tags
2. Suggest title and categories based on existing content
3. Generate draft or publish-ready post
4. Allow iterative editing and refinement
5. Publish when confirmed
6. Push changes to GitHub using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification)

## Safety
- Require single-user authentication (API key or bearer token) on every request
- Never log secrets
- Ask for confirmation before destructive actions (delete, overwrite, unpublish)
- Prevent path traversal and restrict file access to the blog repository
- Check for git conflicts before pushing