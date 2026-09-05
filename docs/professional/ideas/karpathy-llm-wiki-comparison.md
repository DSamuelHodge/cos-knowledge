---
title: Karpathy LLM Wiki — comparison with our KB
id: professional/ideas/karpathy-llm-wiki-comparison
type: note
category: professional
updated: 2026-09-05
status: current
tags: [research, kb, llms, wiki, comparison]
tools: [codex, claude-code, blume, media-pipeline]
---

_Source pattern: [LLM Wiki — Karpathy source](karpathy-llm-wiki-gist.md).
Companion: [media-pipeline ingest workflow](../workflows/media-pipeline-ingest.md)._

## The pattern in one line

Karpathy's LLM Wiki replaces query-time RAG rediscovery with a **persistent,
LLM-maintained, interlinked markdown wiki** between you and the raw sources:
ingest compiles once and keeps current; answers are filed back; the wiki
compounds. Three layers — immutable **raw sources**, an **LLM-owned wiki**,
and a **schema** doc that disciplines the maintainer.

## Comparison

| Axis | Karpathy LLM Wiki | cos.hodgederrick.com (ours) |
|---|---|---|
| Synthesis | LLM updates entities on ingest, flags contradictions | Content authored (human/agent); no auto cross-page update on ingest |
| Raw layer | Immutable `raw/` + web clipper | **media-pipeline** (`ingest.hodgeluke.com`) — R2 originals, derived markdown/transcripts |
| Compounding | Queries filed back as pages | Strong contract, but filing is manual (this page is an instance) |
| Query | LLM reads `index.md` → pages → cites | MCP `search_docs` (Orama) + `contentTypes`/facets + `.md` mirrors + llms.txt |
| Lint | Contradictions/orphans/stale passes | Build-strict frontmatter + dangling-edge hard fail; **orphan report added to graph export** |
| Log | LLM-maintained `log.md` (append-only) | **`log.md` generated from git history each build** |
| Graphview | Obsidian graph | `knowledge-graph.json` nodes/edges + facets |
| Delivery | local Obsidian + git | public, CDN, CI-verified, MCP-served |

## Deltas adopted

1. **Raw layer = media-pipeline.** Uploads land as immutable originals in R2;
   audio → Whisper v3 Turbo transcript (+VTT), PDFs → Firecrawl parse →
   Markdown. That is exactly Karpathy's "raw sources" bucket, outside the git
   repo.
2. **Schema doc** — this repo's `SCHEMA.md` = the third layer (the
   maintainer-contract); updated with ingest rituals from the media pipeline.
3. **Lint/health** — graph export now reports type counts, degree stats and
   orphan nodes; CI fails on dangling edges already.
4. **`log.md`** — build-generated, git-derived, greppable (`## [yyyy-mm-dd]`).
5. **Answer-filing** — analyses like this one and the Flue review are filed
   into `professional/ideas/` on the same tick.

## Remaining gap

The true compounding loop — "source lands, related pages update, log entry,
cross-references refreshed" — still runs as a manual/tool-assisted ritual
(SCHEMA.md defines it), not an automated Cloudflare workflow. When the S1
cleanup pass and note-extraction stage are wired into media-pipeline
(meeting → transcript → cleaned notes → frontmatter-ready drafts), the loop
closes end to end: upload once, KB updates itself.