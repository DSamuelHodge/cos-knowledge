# CoS Knowledge

Derrick Hodge — unified personal & professional knowledge base.

- **Source:** Markdown in `docs/` (Blume content root)
- **Build:** [Blume](https://useblume.dev) (Astro-based, static)
- **Live:** https://cos.hodgederrick.com (Cloudflare Pages)
- **Fallback:** GitHub Pages (public) from the same build
- **Push to deploy:** any push to `main` builds and deploys both surfaces

## Structure

```
docs/
  index.md              # landing
  personal/            # life-side knowledge
    people/ health/ finances/ home/ learning/ goals/ travel/
  professional/        # work-side knowledge
    briefings/ projects/ workflows/ decisions/ commitments/ people/ cadence/
```

Every section opens with `index.md` following a fixed skeleton:
Description, Purpose, Content overview, Formatting guidelines, Recommended
tools. Every page carries a strict frontmatter contract —
`id`, `type`, `category`, `updated`, `tags` (validated at build time by
`blume.config.ts`) — so the tree can be parsed into a knowledge graph later.

## Local dev

```
npm install
npm run dev     # preview at localhost
npm run build   # static output in dist/
```

## Authoring conventions (codified 2026-09-05)

These rules are enforced by convention and by `blume.config.ts` frontmatter
schemas; the build is the referee (unknown keys fail).

1. **Titles live in frontmatter only.** Never put a `# H1` in the body —
   Blume renders the page title from frontmatter and duplicates a body H1.
   Start bodies at `##`.
2. **Page contract.** Every page carries `id` (required — graph key),
   `type` (section/person/project/decision/briefing/workflow/commitment/goal/
   routine/note), `category` (personal|professional), `status`
   (draft|current|archive), `updated`, `tags`, `tools`.
3. **Section SKILL.md pages.** Each section folder's `index.md` documents
   Description, Purpose, Content overview, Formatting guidelines,
   Recommended tools — the template for that section.
4. **High-frequency content (daily briefings): date hierarchy.**
   `briefings/2026/09/05-morning-briefing.md` — year/month folders with
   `meta.ts` titles, no `index.md` inside date folders (avoids landing-page
   title duplication and sidebar clutter), date kept in the file name.
5. **Numeric prefixes sort and are stripped from URLs** (`2026-09-05-…` →
   route `/…/09-05-…`). Sort is ascending, so for newest-first pin each
   folder's `meta.ts` `pages` array.
6. **Sidebar shaping.** Global `display: "group"`; a section with many
   children sets `sidebar.display: page` (drill panel) on its index page or
   `display` in `meta.ts`; per-page `sidebar: { label, order, hidden, badge }`.
7. **No secrets in this repo.** Anything sensitive lives in `pass`
   (same-named entries); the repo is public and feeds GitHub Pages.

## Agent / API surface (server build)

- **MCP server**: `https://cos.hodgederrick.com/mcp` (Streamable HTTP) —
  tools `search_docs`, `get_page`, `list_pages`, `get_navigation`; discovery
  at `/.well-known/mcp.json`. Connect: `claude mcp add --transport http
  cos kb https://cos.hodgederrick.com/mcp`
- **Programmatic search without MCP**: `GET /blume-search.json` (Orama index) —
  fetch and query with any Orama client.
- **Raw Markdown**: `/{route}.md` (200 for leaf and index pages) or
  `GET /{route}` with `Accept: text/markdown` (server negotiation).
- **Corpus**: `llms.txt`, `llms-full.txt`; discovery manifest
  `agent-readability.json`.
- **Knowledge graph**: `knowledge-graph.json` — materialized `{nodes, edges,
  stats}` from page frontmatter (`id`/`type`/`category`/`status`/`tags`/
  `tools`) and relative `.md` links. `stats` includes type/category counts,
  degree spread, and the orphan list (lint). Emitted by `npm run graph` after
  every build; dangling edges hard-fail CI.
- **Change log**: `log.md` — build-generated from git history, greppable
  (`grep "^## \[" log.md`).
- **Maintainer contract**: `SCHEMA.md` (root) — layers, page contract,
  ingest/query/lint operations, media-pipeline mapping.
- **Facets**: `category`/`status` are facet keys per content type — filter
  `search_docs` via the MCP `filters` argument (`{"category":"professional"}`)
  and the on-page search dialog.

## Deploy credentials

- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GitHub secrets (see
  `pass cloudflare-api-token` locally); raw token never committed.