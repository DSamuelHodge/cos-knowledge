---
title: Media pipeline ingest
id: professional/workflows/media-pipeline-ingest
type: workflow
category: professional
updated: 2026-09-05
status: current
tags: [workflow, media, ingest, whisper, pdf, transcript]
tools: [media-pipeline, macro, whisper, firecrawl]
---

## Description

Bring media into the knowledge base through the Cloudflare media pipeline:
upload originals, get derived text (transcripts, converted Markdown), then
extract notes and tasks into cos.hodgederrick.com sections.

## Purpose

One ingest path for everything non-text: meeting recordings, voice memos,
PDFs, images. Originals stay immutable in R2; the KB keeps derived, typed,
frontmatter-compliant pages with links back to the media.

## Pipeline surface (verified)

| Surface | Value |
|---|---|
| API/UI | `https://ingest.hodgeluke.com` (UI: "Library — Hodge Luke") |
| Public files | `https://media.hodgeluke.com` (+ `cdn-cgi/image/…` zone transforms) |
| Agent docs | `/llms.txt`, `/openapi.json` |
| Upload token | `pass show cloudflare/media-pipeline/upload-token` (Bearer, uploads only; reads public) |
| Refine (S1-mini) | `GET /assets/{id}/refined` — S1-mini cleaned transcript (derived/refined/{id}.md); requires `HF_TOKEN` worker secret + `REFINE_MODEL` var |
| Notes extraction | `GET /assets/{id}/notes` — JSON `{summary, notes, tasks, action_items}` (derived/notes/{id}.json), LLM via `EXTRACT_MODEL` |
| Source | `github.com/DSamuelHodge/media-pipeline` (R2 + D1 + Workflows + Whisper v3 Turbo + Firecrawl + S1-mini refine) |

Kinds: `image`, `video`, `audio`, `pdf`. Images/video → `201` ready on
arrival; audio/PDF → `202`, poll `/assets/{id}/status` until `ready|failed`.

## Steps

### 1. Upload

```bash
TOKEN=$(pass show cloudflare/media-pipeline/upload-token | head -1)
curl -X POST https://ingest.hodgeluke.com/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./meeting.m4a" -F "title=2026-09-05 staff sync"
```

### 2. Wait, then pull the derived text

```bash
curl https://ingest.hodgeluke.com/assets/<id>/status
curl https://ingest.hodgeluke.com/assets/<id>/transcript   # audio
curl https://ingest.hodgeluke.com/assets/<id>/refined      # audio, S1-mini cleaned
curl https://ingest.hodgeluke.com/assets/<id>/markdown      # pdf
```

Refine runs best-effort inside the audio pipeline (absent `HF_TOKEN` → the
stage is skipped; failures never fail the asset). `refined` may legitimately
be empty for filler-only audio; `409` until present.

### 3. Extract notes and tasks

From transcript/Markdown, produce frontmatter-compliant pages:

- Meeting/voice notes → `professional/briefings/YYYY/MM/DD-slug.md`
  (decision section from the recording, link the source URL + transcript)
- Action items → `professional/commitments/` list lines (or Kaneo)
- Videos/images → embed the `media.hodgeluke.com` link in the appropеlia section
- Research PDFs → `professional/ideas/` or the section the topic belongs to

### 4. Close the loop

- Append a `## [date]` entry (see repo `log.md` convention)
- Run `npm run graph` (emits `knowledge-graph.json` + `log.md` in every build)
- Any dangling/typo breaks CI before it ships

## Lane notes

- **Whisper v3 Turbo** (audio): transcript + VTT in `derived/transcripts/`.
- **S1-mini refine** (shipped in media-pipeline, see
  [S1 integration plan](../ideas/s1-transcript-refinement-plan.md)): the raw
  ASR text is cleaned (fillers out, numbers/dates/emails normalized) by
  `superwhisper/s1-mini` via HF Inference before note extraction.
- **Firecrawl → toMarkdown** (PDF): research docs become clean Markdown;
  run the extraction step above on the result.
- **Shared folder**: treat the pipeline as the shared inbox — anyone (Derrick
  or the CoS) with the upload token can drop media; both parties pull from
  `/assets` and file into the KB. No local synced folder required.
- Secrets never in git: token comes from pass; keys live in Worker
  secrets/Secrets Store.

## Recommended tools

media-pipeline (ingest), macro (workspace context), pass (token),
whisper/firecrawl (derived text)