---
title: Personal Chief of Staff — Architecture Plan
id: professional/ideas/flue-co-s-architecture-v0.2
type: note
category: professional
updated: 2026-09-05
status: draft
tags: [design, flue, cos]
tools: [flue, macro, termux]
---

## At a glance

| | |
|---|---|
| **Stack** | Flue (agent harness) → Cloudflare Workers / Agents SDK |
| **Integrations** | Android (Termux device layer), Macro.com (MCP workspace layer) |
| **Autonomy** | Full — agents execute directly, no human-in-the-loop gating |
| **Status** | Draft v0.2 — for review before implementation |

## 1. What this system is

A single orchestrating agent (the **Chief of Staff**, or **CoS**) that holds situational awareness of your daily/weekly/monthly life — personal and professional — and delegates concrete work to a small bench of specialist subagents. The CoS never does the work itself; it plans, routes, checks results, and reports back. Subagents act on your behalf through two surfaces:

- **Android phone** — via Termux, a full shell/API/server environment
- **Macro.com** — via its MCP server (~67 tools spanning email, chat, docs, tasks, calls, CRM)

### Design principles

- **One brain, many hands** — a single context/memory layer feeds every subagent, so they never contradict each other or duplicate work.
- **Harness-first** — following Flue's model (Agent = Model + Harness), behavior lives mostly in Markdown skills, not hardcoded prompts. Tune the CoS by editing files, not redeploying logic.
- **Durable by default** — every agent run is an append-only log (Flue's Durable Streams); a crashed subagent resumes rather than restarts, and there's a full audit trail of what was done on your behalf.
- **Full agent autonomy** — subagents execute directly against Macro's MCP tools and the Termux bridge; no approval gate blocks execution. Every action is still logged to the decision log in real time, pairing autonomy with a complete, reviewable audit trail rather than a blind spot.

## 2. High-level architecture

```
                         ┌─────────────────────────────┐
                         │        YOU (human)          │
                         │  briefings · direct         │
                         │  requests · audit review    │
                         └───────────┬─────────────────┘
                                     │ chat / push / voice
                                     ▼
                     ┌───────────────────────────────┐
                     │      CHIEF OF STAFF AGENT      │
                     │   (Flue agent, Cloudflare      │
                     │    Worker, orchestration loop) │
                     │                                │
                     │  - reads Context Store         │
                     │  - plans (parallel/pipeline)   │
                     │  - delegates to subagents      │
                     │  - reconciles results          │
                     │  - executes autonomously       │
                     └───────┬───────────┬────────────┘
                             │           │
              ┌──────────────┘           └───────────────┐
              ▼                                           ▼
   ┌─────────────────────┐                     ┌─────────────────────┐
   │   SUBAGENT BENCH     │                     │   CONTEXT / MEMORY   │
   │  (Flue agents, each  │◄───────────────────►│        LAYER         │
   │  with own SKILL.md)  │   read/write ctx    │  Durable Objects +    │
   │                       │                     │  D1 + Vectorize + KV │
   │ - Calendar/Time       │                     │  - daily/weekly/     │
   │ - Comms (email/chat)  │                     │    monthly goals     │
   │ - Tasks/Projects      │                     │  - rolling summaries │
   │ - Research/Prep       │                     │  - preferences       │
   │ - Device Agent        │                     │  - decision/audit log│
   │ - Macro Agent         │                     └─────────────────────┘
   └───────┬───────┬───────┘
           │       │
           ▼       ▼
   ┌──────────────────┐  ┌────────────────────┐
   │  ANDROID LAYER     │  │   MACRO.COM LAYER   │
   │  Termux shell/API/  │  │  Macro MCP server    │
   │  server on-device    │  │  (~67 tools)         │
   └──────────────────┘  └────────────────────┘
```

## 3. Agent bench

All agents are Flue agents (`agents/<name>.ts`), each with its own `SKILL.md`, tool bindings, and sandbox. The CoS is the only agent that talks to you directly; subagents report to the CoS.

| Agent | Responsibility | Primary tools |
|---|---|---|
| **Chief of Staff** | Owns the daily/weekly/monthly plan, decomposes requests, delegates via `parallel()`/`pipeline()`, arbitrates conflicts, drafts morning/evening briefings, executes end-to-end | Context Store read/write; all subagents as tools |
| **Calendar/Time** | Schedule awareness, conflict detection, time-blocking, meeting-prep triggers, direct rescheduling | Macro MCP calendar tools · Termux calendar/notification tools |
| **Comms** | Triage email/chat, draft and send replies, flag/act on urgent items, summarize threads | Macro MCP mail/chat tools |
| **Tasks/Projects** | Maintain task lists, track goal progress, close stale items directly | Macro MCP tasks/CRM tools |
| **Research/Prep** | Pulls background before meetings/decisions; web search; doc summarization | Web search · Macro MCP docs tools |
| **Device** | Executes on-phone actions via Termux: notifications, reminders, location-aware nudges, device state read/control | Termux shell + Termux:API + local server |
| **Macro Agent** | Thin router into Macro's MCP server — every subagent reaches the full ~67-tool surface without each reimplementing Macro logic | Macro MCP server (full tool catalog) |

Each subagent is **stateless between calls** — all durable state lives in the Context Store, not the agent process. That's what lets a subagent restart cleanly via Durable Streams, and keeps a fully autonomous system auditable: nothing is remembered only inside an uninspectable process.

## 4. Flue framework mapping

```
/cos-project
  /agents
    chief-of-staff.ts        # orchestrator harness config
    calendar-agent.ts
    comms-agent.ts
    tasks-agent.ts
    research-agent.ts
    device-agent.ts
    macro-agent.ts
  /skills
    cos-planning.md          # how the CoS decomposes a request
    cos-briefing.md          # daily/weekly/monthly briefing format
    calendar-triage.md
    comms-triage.md
    tasks-hygiene.md
    autonomy-guardrails.md   # hard limits agents must never cross, even autonomously
  /connectors
    macro-mcp.md             # Macro MCP server connection + tool catalog notes
    termux-bridge.md         # Termux shell/API/server install + tool bindings
  flue.config.ts
```

**Key Flue mechanics this design leans on:**

- **Harness config per agent** — model choice, sandbox type, filesystem/tool access are declared per agent file: the Comms Agent (needs email-send access) is scoped differently from the Research Agent (needs only web search + read-only docs).
- **`parallel()` / `pipeline()`** — the CoS uses `parallel()` for independent fan-out ("check calendar + triage inbox + review task list" simultaneously) and `pipeline()` for dependent chains ("research the person → draft the prep doc → notify me"), so a slow step doesn't block completed fast ones.
- **Direct execution, no approval wrapper** — subagent tool calls (Macro MCP tools, Termux commands) execute immediately as part of the plan. There is no `withApproval()` gate in this configuration.
- **Skills as Markdown** — preferences (email tone, triage aggression, what counts as "urgent," hard limits) live in editable `.md` files, not code.
- **Durable Streams** — every plan step and tool call is logged as it happens; if a Worker is evicted mid-task, another invocation resumes from the last committed step instead of repeating side effects.

## 5. Cloudflare deployment

| Concern | Cloudflare primitive | Why |
|---|---|---|
| Agent runtime | **Workers** (`flue build --target cloudflare`) | Each agent deploys as a Worker; harness runtime handled by Flue |
| Durable session/state | **Durable Objects** | One DO per "day" or active plan gives strict ordering, avoids subagent write races |
| Long-term memory | **D1** (goals, tasks, decision/audit log) + **Vectorize** (semantic recall) | Cheap relational store + vector search ("what did I promise the Q3 vendor?") |
| Fast/session cache | **KV** | Preferences, current-day snapshot, guardrail config |
| Async work / fan-out | **Queues** | Subagent tasks that don't need immediate reply (e.g., nightly triage) |
| Scheduled rituals | **Cron Triggers** | Daily morning/evening briefings, weekly review (Sunday), monthly check-in |
| Device/webhook ingress | **Workers (public HTTPS)** | Receives Termux bridge + Macro MCP/webhook events |
| Secrets | **Wrangler secrets / Secrets Store** | Macro credentials, Termux pairing keys — never in code |

## 6. Android integration layer — Termux

Termux gives the phone a real Linux userland: shell, package manager, and (with add-ons) an HTTP-callable API and persistent local server — replacing a bespoke companion app. The Device Agent talks to the phone like any remote host.

**Components:**

| Component | Role |
|---|---|
| **Termux** | Base shell environment; runs the bridge process + CLI tools |
| **Termux:API** | Exposes device functions (notifications, SMS, location, battery, clipboard, sensors, calendar) as `termux-*` shell invocations |
| **Termux:Boot** | Starts the bridge process automatically on boot, keeping the phone reachable without manual relaunch |
| **Local bridge server** | Small process (Node/Python) exposing `termux-*` commands over an authenticated HTTP **API** and keeping an **outbound** connection (websocket/long-poll) to the Worker ingress — reachable across NAT/carrier networks with no public on-device port |

**What the Device Agent can do directly:**

- Push native notifications and reminders (`termux-notification`)
- Read/act on calendar, SMS, clipboard, location, battery, sensor state
- Trigger device actions (dialer, share intents, vibration, TTS) via `termux-*` commands
- Run staged shell scripts for more complex on-device workflows

**Security:** the bridge authenticates to the Worker with a scoped, rotatable pairing token. Even under full autonomy, its command surface is an explicit **allow-list of `termux-*` invocations plus vetted scripts** — not an open shell — bounding the blast radius of a bad plan. Every command goes to the same Durable Stream/audit log as every agent action.

## 7. Macro.com integration layer — MCP

Macro exposes an MCP server with **~67 tools** covering its full product surface (mail, chat, docs, tasks, calls, CRM, unified search, automations). The Macro Agent connects directly to this server and exposes its catalog to whichever subagent needs it:

- **Comms Agent** → mail/chat tools (read, draft, send)
- **Tasks/Projects** → task/CRM tools (read, create, update, close)
- **Calendar/Time** → calendar tools (read, create, reschedule, cancel)
- **Research/Prep** → docs/search tools (read-only)

**All writes execute directly through MCP — no staging step.**

**Practical notes for the build:**

- **Scope tool subsets** — document the MCP server URL, auth, and per-subagent tool restrictions in Flue's `/connectors/macro-mcp.md`; don't hand every subagent all 67 tools.
- **Pull the live tool catalog at build time** rather than hardcoding it — `~/67` is a snapshot count, not a contract; actively developed MCP servers shift.
- **Macro Automations** can be triggered as one of those MCP tools where a Macro-side workflow fits better than reimplementing logic in a subagent.

## 8. Situational awareness / context layer

The Context Store is what makes this a *chief of staff* rather than a task runner.

**Schema sketch (D1):**

```
goals(id, horizon[daily|weekly|monthly], domain[personal|professional], text, status, created_at, review_at)
commitments(id, source[macro|termux|manual], type[meeting|task|deadline], when, related_goal_id)
decisions(id, summary, rationale, action_taken, made_at, related_goal_id)
preferences(id, key, value)         -- tone, guardrails, quiet hours, etc.
daily_context(date, summary, open_loops, energy_notes)
```

**Rituals:**

- **Daily briefing** — today's commitments, top 3 priorities against active goals, what the CoS already acted on overnight
- **Weekly review** (Sunday) — goal progress, what slipped, what to re-prioritize
- **Monthly** — personal/professional goal check-in, where time went vs. intended

**Vectorize** handles fuzzy recall ("what did I promise the Q3 vendor?") by embedding daily summaries, decision logs, and Macro doc/email content — grounding planning and autonomous actions in real history instead of the last few turns.

## 9. Autonomy & guardrails

With no approval gate, safety shifts from *ask first* to *constrain the tool surface and log everything*:

- **Scoped tools, not scoped judgment.** Each subagent's harness exposes only the MCP/Termux surface it needs — the Comms Agent can't touch CRM records; the Research Agent can't send mail.
- **Explicit guardrails file (`autonomy-guardrails.md`).** Hard rules checked before acting — spend limits, do-not-contact lists, quiet hours, message categories that must never be auto-sent. A skill file, not code: amend without a redeploy.
- **Full audit log.** Every MCP tool call and Termux command goes to the decision/audit log with its reasoning, in real time — visibility instead of a pre-execution checkpoint.
- **Reversibility bias in planning** (`cos-planning.md`): all else equal, prefer the more reversible path (draft-and-hold vs. send) when sending isn't required — a planning preference, not a gate.

## 10. Example flow — "Prepare me for tomorrow"

1. You message the CoS (chat, or it fires on the evening cron).
2. CoS reads the Context Store for tomorrow's commitments and active goals.
3. `parallel()`: Calendar Agent confirms tomorrow's schedule and resolves conflicts via Macro MCP → Comms Agent triages the inbox and sends any time-sensitive reply inside guardrails → Research Agent pulls background on tomorrow's external meeting (Macro CRM/docs + web search).
4. CoS reconciles results and drafts the briefing.
5. Device Agent pushes the briefing as a native Android notification via the Termux bridge at your preferred time.
6. Every action taken (reschedules, replies, research) is already in the Context Store's decision log — reviewable whenever you want, not before it happened.

## 11. Phased build plan

1. **Foundation** — Flue scaffold, Cloudflare deploy target, Context Store schema, bare CoS agent.
2. **Macro MCP integration** — Macro Agent connected, per-subagent tool scoping, daily briefing cron (**read-only to start**).
3. **Comms/Tasks/Calendar Agents** — full read+write via Macro MCP; **guardrails in place before first autonomous send/reschedule**.
4. **Termux bridge** — base + `termux-api` + `termux-boot`, local bridge server, Device Agent wired to Worker ingress.
5. **Research Agent + Vectorize memory** — richer meeting prep, historical recall.
6. **Guardrail tightening pass** — review audit log after a couple weeks of live operation; refine `autonomy-guardrails.md`.
7. **Review rituals close** — weekly/monthly loops.

## 12. Open risks

- Macro's MCP catalog should be **pulled live at build/connect time** — confirm tool list, scopes, auth model rather than relying on the ~67 figure.
- Termux background execution can still be checked by Android's battery/Doze even with Termux:Boot — prefer the **bridge holding an outbound connection** over OS-wake triggers.
- With full autonomy, a bad plan executes before anyone sees it — the guardrail file and audit trail are **load-bearing, not optional**; write and review them before Phase 3 goes live with real sends.
- Cost/rate limits on Cloudflare **Queues + Vectorize** and on **Macro's MCP server** at expected action volume.