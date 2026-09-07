---
id: professional/projects/intents
type: section
category: professional
updated: 2026-09-06
tags: [section, intents]
title: Intents
---

## Description

Intents capture the originator's own words before design — what isn't working, what better looks like, who is affected, and what must be respected. Each intent lives as its own page under this folder.

## Purpose

Single home for Stage 1 (Intent) artifacts. Product owner reviews: acceptance = merge to Design; rejection = closed review.

## Catalogs

Related central catalogs (versioned, cross-project):

- [`DSamuelHodge/skills`](https://github.com/DSamuelHodge/skills) — skill catalog (`catalog.yaml`, SemVer tags)
- [`DSamuelHodge/prompts`](https://github.com/DSamuelHodge/prompts) — prompt catalog (`catalog.yaml`, SemVer tags)

Lifecycle: `draft → current → deprecated`, consumed via git tag / release.

## Content overview

One file per intent: `docs/professional/projects/intents/<kebab-id>.md` with `type: intent`. Copy `_template.md` to start.

## Formatting guidelines

Frontmatter: `id`, `type: intent`, `category: professional`, `updated`, `status: draft|current|archive`. Body follows the Intent template (Problem → Proposed outcome → Affected users → Constraints → Open questions).
