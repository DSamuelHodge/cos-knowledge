---
title: Push jobs — setup & config
id: professional/cadence/push-jobs-setup
type: workflow
category: professional
updated: 2026-09-06
status: current
tags: [cadence, push, jobs, automation, setup]
tools: [push, telegram, codex]
---

## Description

How the CoS's scheduled jobs work and how to turn them on. Source of truth:
`/Users/hodgeluke/Code/assistant` (SOUL, context/, skills/, jobs/, evals/).

## Purpose

Jobs are the *proactive* half of the CoS: durable runbook instructions that
fire on a schedule (or on demand) and deliver to Telegram. This page is the
operational checklist so the cadence stops being dormant.

## How it works

- **Runbook** = `jobs/<name>.md`: TOML frontmatter (`version`, `timeout`,
  `backend`, `evals`, `schedule`) + agent instructions in the body.
- **Persistent state** — `context/` (durable facts, read via
  `context/README.md`), `skills/` (procedures), `evals/` (quality gates,
  e.g. `chief-of-staff-quality`).
- **Lifecycle**: author → `push job validate` (working Push CLI — the local
  `bash` stub cannot) → schedule review (**owner approval**, tracked in
  `~/.push/push.db` `job_schedule_*`) → cron fires → agent runs → reply to
  Telegram → run logged in `job_runs`. Manual: `push job run <name>`.

## Current state (2026-09-06)

| Job | Schedule | Status |
|---|---|---|
| `daily-command-brief` | none written | Awaiting setup |
| `focus-reset` | on-demand | Awaiting setup |
| `relationship-followup-review` | none written | Awaiting setup |
| `hf-inference-dns-monitor` | hourly (WIP) | Awaiting validate + owner review |

`job_runs` in `push.db` = **0 executions ever** — nothing has been
operationalized yet.

## Checklist to go live

1. On the working Push instance: `push job validate jobs/<name>.md` for each
   runbook, fix schema diffs.
2. Approve the enabled schedules in Push's owner review.
3. Smoke run each: `push job run <name>` and confirm the Telegram delivery.
4. Recommended defaults:
   - `daily-command-brief` → 07:30 local (morning brief: Now / Open loops /
     People / Focus / Ask)
   - `relationship-followup-review` → weekly (Sunday evening)
   - `hf-inference-dns-monitor` → hourly while the HF record is missing
5. Keep runbooks in sync when schedule shapes change (update this page too).

## Guardrails

- Sensitive inputs (tokens) live in `pass`, never in runbook bodies.
- Jobs with external side effects need explicit authorization in the body
  (like the DNS monitor's "never upload without user go" rule).
- Log evaluation: `push job runs`/`reviews` to watch quality-gate results
  (`chief-of-staff-quality`).