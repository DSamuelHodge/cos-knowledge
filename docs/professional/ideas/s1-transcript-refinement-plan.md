---
title: S1 transcript refinement — integration plan
id: professional/ideas/s1-transcript-refinement-plan
type: note
category: professional
updated: 2026-09-05
status: draft
tags: [design, media-pipeline, s1, whisper, tts, plan]
tools: [media-pipeline, workers-ai, whisper, github, blume]
---

_Parents: [media-pipeline ingest workflow](../workflows/media-pipeline-ingest.md),
[media-pipeline comparison](../ideas/karpathy-llm-wiki-comparison.md)._

## Goal

Close the ingest loop: transcript → cleaned (S1) → summarized + notes/tasks
extracted (LLM) → **published on cos.hodgederrick.com with media links
(audio, transcript, VTT, cleaned)**. Future: TTS renders the notes page to
audio for on-site playback.

## Flow

```
upload (audio) ──► Whisper v3 Turbo ──► transcripts/{id}.md (+ .vtt)   [today]
                             │
                             ▼
  REFINE (S1, Cloudflare) ──► refined/{id}.md        (clean, readable, diarized if available)
                             │
                             ▼
  EXTRACT (LLM, JSON mode) ──► meta/{id}.json        {summary, notes[], tasks[], action_items[]}
                             │
                             ▼
  PUBLISH ──► cos.hodgederrick.com page             (typed, frontmatter, media links)
                             │
                    [future: TTS] ──► audio/{id}.mp3 embedded player
```

## Model layer

- **S1** — the cleanup model, called through **Workers AI / AI Gateway**
  (model id env-driven: `REFINE_MODEL`). First implementation task: confirm
  S3 availability through this account `GET /accounts/{a}/ai/models` (token:
  `pass cloudflare/workers-ai` to be created).
- **Fallback chain** in code: `S1 → Qwen3-32B → Llama-3.3-70B` if a model id
  is missing or fails; the worker logs which model produced the refinement.
- **Extraction LLM** — same service, JSON-mode schema:
  `{ summary, notes: string[], tasks: {text, priority?, due?}[],
  action_items: string[] }`; validated against a zod schema served by the
  repo; invalid output → retry once → `failed` status.
- **Edit/prompt artifacts** live in `media-pipeline/refine/` (prompt.md,
  schema.json) so prompts are versioned like code.

## 3. Data & storage (additions)

| Derived key | Content |
|---|---|
| `derived/refined/{id}.md` | S1-cleaned transcript (markdown) |
| `derived/meta/{id}.json` | extracted summary/notes/tasks payload (+model, ts) |
| `derived/audio/{slug}.mp3` | TTS of the notes page (future) |

R2 keys stay under `derived/`; D1 gains `refined_at`, `notes_json` columns
(or a `refinements` table keyed by asset).

## 4. API surface (additions to media-pipeline)

| Method | Path | Notes |
|---|---|---|
| GET | `/assets/{id}/refined` | cleaned markdown; 202 until ready |
| GET | `/assets/{id}/notes` | extracted JSON + summary markdown |
| POST | `/assets/{id}/reprocess` | re-run refine/extract on demand |
| (internal) | Workflow step | fired on transcript `ready` |

## 5. Publishing to cos.hodgederrick.com

Two tiers (agree which ships first):

- **Tier A — CoS ritual (fastest):** the agent polls `/assets?kind=audio`,
  pulls `refined` + `notes`, and files a KB page via the normal PR→CI path
  (SCHEMA.md ingest). Media links via frontmatter `media_links`.
- **Tier B — automated draft (desired):** a Cloudflare Workflow step calls
  GitHub's API (repo token in Secrets Store) to open a PR that adds
  `docs/professional/briefings/…/asset-slug.md` with frontmatter-complete
  page (summary + notes + tasks + links). Human (or CoS) reviews the PR;
  CI publishes. Never force-push to main.

**Published page contract** (frontmatter):

```yaml
---
title: <Asset title>
id: professional/ideas/media/<asset-id>
type: note
category: professional
status: draft
updated: YYYY-MM-DD
tags: [media, transcript, meeting]
tools: [media-pipeline]
media_links:
  audio: https://media.hodgeluke.com/originals/audio/<id>.m4a
  transcript: https://media.hodgeluke.com/derived/transcripts/<id>.md
  refined: https://media.hodgeluke.com/derived/refined/<id>.md
  vtt: https://media.hodgeluke.com/derived/transcripts/<id>.vtt
---
```

## 6. TTS (future enhancement)

- Provider: Workers AI TTS if catalog offers it, else OpenAI/ElevenLabs via
  gateway; model env-driven (`TTS_MODEL`).
- Input: the published notes page markdown → `audio/{id}.mp3` in R2 →
  served at `media.hodgeluke.com` → embedded `<audio controls>` on the page.
- Rebuild-on-demand: page edit → re-render audio (checksum keyed).

## 7. Phasing

1. **P0 — verify model access**: create `pass cloudflare/workers-ai` token;
   scan `/ai/models` for S1; pick fallback set; spike REFINE step inside the
   worker Workflow.
2. **P1 — refine+extract**: worker steps emit `refined` + `notes`
   endpoints; D1 updated; zod-validated extraction; tests (vitest, ~90%).
3. **P2 — publish**: Tier A (CoS ritual) + Tier B (PR workflow) — decide.
4. **P3 — TTS playback** (opt-in).

## 8. Risks

- **S1 availability** unverified (no Workers AI token/pass entry yet) —
  P0 is a hard gate; fallback chain makes the pipeline model-agnostic.
- **Whisper output has no diarization** — cleanup can't assign speakers
  reliably; flag as optional later pass (separate model/step).
- **Privacy** — transcripts/refined stay private R2 until explicitly
  published; publishing is an explicit PR/action, never auto-merge to main.
- **Cost** — refine/extract run per asset (tokens), TTS per render; bound via
  queue limits + model size policy.

## 9. Open questions before build

1. S1 = which exact model id? (P0 answers.)
2. Tier A or Tier B publish first?
3. Where do meetings enter: direct upload from phone (recorder app → `ingest`)
   or via the existing Termux bridge helper?