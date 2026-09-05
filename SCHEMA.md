# CoS KB — Schema & Maintainer Contract

The third layer of the KB (per Karpathy's LLM-wiki pattern). This file tells
any maintainer — human or agent — how the wiki is structured, what the
conventions are, and which workflows to run. Co-evolve it as the domain
grows; keep it short enough to re-read every session.

## Layers

1. **Raw sources (immutable)** — the media pipeline:
   - `https://ingest.hodgeluke.com` (API/UI), files at `https://media.hodgeluke.com`
   - Upload token: `pass show cloudflare/media-pipeline/upload-token`
   - Audio → Whisper v3 Turbo transcript (+VTT); PDF → Firecrawl → Markdown
   - Originals are never modified; the wiki only references derived text.
2. **The wiki** — this repo (`docs/`), rendered at `cos.hodgederrick.com`.
   Agents/humans write it; Blume validates and ships it.
3. **The schema** — this file + `blume.config.ts` (frontmatter contract,
   facets) + section index pages (the per-section SKILL.md).

## Page contract (must never vary)

Every page carries in frontmatter:

- `id` — stable kebab-case, required (graph key)
- `title` — frontmatter only; **never** a `# H1` in the body (Blume renders it)
- `type` — section | person | project | decision | briefing | workflow |
  commitment | goal | routine | note
- `category` — `personal` | `professional`
- `status` — `draft` | `current` | `archive`
- `updated` — `YYYY-MM-DD`
- `tags`, `tools` — arrays; tags are the free vocabulary

Unknown keys **fail the build** — typos are caught, not shipped.

## Operations

**Ingest** (source lands → wiki updates):

1. Upload to media-pipeline; pull `transcript`/`markdown` when `ready`.
2. Write/update the typed page(s) it touches (briefing, decision,
   commitment, person, project…), frontmatter-complete.
3. Reference the source with a relative `.md` link (graph edge) and/or the
   `media.hodgeluke.com` URL.
4. Keep the section's `index.md` short; the sidebar builds itself.

**Query**: MCP `search_docs` (`/mcp`) with `contentTypes` + `filters`
(category/status facets); raw: `/{route}.md` mirrors, `llms.txt`,
`knowledge-graph.json`.

**Lint** (on every build, enforced):
- Frontmatter validation (strict) — typos fail CI.
- `npm run graph` — page `knowledge-graph.json` + `log.md`; dangling edges
  hard-fail; stats report orphans/degree to eyeball.
- Manually/generally, watch for stale `status`, contradictions between
  pages, and off-contract shortcuts.

## Log convention

`log.md` (build-generated from git history): chronological, greppable —

```bash
grep "^## \[" log.md | tail -5
```

## Tools map

| Surface | Where |
|---|---|
| Media intake | ingest.hodgeluke.com / media.hodgeluke.com |
| Workspace context | Macro MCP (email/chat/calendar/CRM), facets |
| Tasks/Kanban | Kaneo (when MCP restored) |
| Secrets | pass (never in repo — repo is public) |
| Memory/search | Vectorize: planned embedding layer over knowledge-graph.json + corpus |