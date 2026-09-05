---
title: Briefings
id: professional/briefings
type: section
category: professional
updated: 2026-09-05
tags: [section]
tools: [macro, calendar, push]
---

## Description
Meeting and executive briefs — purpose, context, agenda, decisions.

## Purpose
Arrive prepared to every engagement; capture decisions out of meetings.

## Content overview
Date hierarchy in the sidebar: `2026/09/05-morning-briefing.md`.
Year and month are folders with `meta.ts` titles; keep a date in the file
name so ordering follows the calendar.

## Formatting guidelines
- Title lives in frontmatter only — no `# H1` inside the body (Blume renders
  the title from frontmatter; a body H1 duplicates it).
- Frontmatter: id, type=briefing, updated, status, tags, tools. Link the
  source calendar event / email where relevant.
- Newest at top reads better for logs — pin order with each month's `meta.ts`
  `pages` array instead of relying on numeric prefixes (which sort ascending).

## Recommended tools
macro, calendar, push