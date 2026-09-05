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

Stack: Flue (agent harness) → Cloudflare Workers / Agents SDK Integrations: Android (Termux device layer), Macro.com (MCP workspace layer) Autonomy: Full — agents execute directly, no human-in-the-loop gating Status: Draft v0.2 — for review before implementation

1. What this system is

A single orchestrating agent (the Chief of Staff, or CoS) that holds situational awareness of your daily/weekly/monthly life — personal and professional — and delegates concrete work to a small bench of specialist subagents. The CoS never does the work itself; it plans, routes, checks results, and reports back to you. Subagents act on your behalf through two surfaces: your Android phone (via Termux, a full shell/API/server environment) and Macro.com (via its MCP server, ~67 tools spanning email, chat, docs, tasks, calls, CRM).

Design principles:

One brain, many hands. A single context/memory layer feeds every subagent so they never contradict each other or duplicate work.
Harness-first. Following Flue's model (Agent = Model + Harness), behavior lives mostly in Markdown skills, not hardcoded prompts — you should be able to tune the CoS by editing files, not redeploying logic.
Durable by default. Every agent run is an append-only log (Flue's Durable Streams), so a crashed subagent resumes rather than restarts, and you get a full audit trail of what was done on your behalf.
Full agent autonomy. Subagents execute directly against Macro's MCP tools and the Termux bridge — no approval gate blocks execution. Every action is still logged to the decision log in real time, so autonomy is paired with a complete, reviewable audit trail rather than a blind spot.
2. High-level architecture

                         ┌─────────────────────────────┐
                         │        YOU (human)          │
                         │   briefings · direct         │
                         │   requests · audit review     │
                         └───────────┬──────────────────┘
                                     │ chat / push / voice
                                     ▼
                     ┌───────────────────────────────┐
                     │      CHIEF OF STAFF AGENT      │
                     │   (Flue agent, Cloudflare      │
                     │    Worker, orchestration loop) │
                     │                                │
                     │  - reads Context Store         │
                     │  - plans (parallel/pipeline)    │
                     │  - delegates to subagents        │
                     │  - reconciles results             │
                     │  - executes autonomously          │
                     └───────┬───────────┬────────────┘
                             │           │
              ┌──────────────┘           └───────────────┐
              ▼                                           ▼
   ┌─────────────────────┐                     ┌─────────────────────┐
   │   SUBAGENT BENCH     │                     │   CONTEXT / MEMORY   │
   │  (Flue agents, each  │◄───────────────────►│        LAYER         │
   │  with own SKILL.md)  │   read/write ctx     │  Durable Objects +    │
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
3. Agent bench

All agents are Flue agents (agents/<name>.ts), each with its own SKILL.md, tool bindings, and sandbox. The CoS is the only agent that talks to you directly; subagents report to the CoS.

Agent	Responsibility	Primary tools
Chief of Staff	Owns the daily/weekly/monthly plan, decomposes requests, delegates via parallel()/pipeline(), arbitrates conflicts, drafts your morning/evening briefings, executes end-to-end	Context Store read/write, all subagents as tools
Calendar/Time Agent	Schedule awareness, conflict detection, time-blocking, meeting prep triggers, direct rescheduling	Macro MCP calendar tools, Termux calendar/notification tools
Comms Agent	Triage email/chat, draft and send replies, flag/act on urgent items, summarize threads	Macro MCP mail/chat tools
Tasks/Projects Agent	Maintains and updates task lists, tracks goal progress, closes stale items directly	Macro MCP tasks/CRM tools
Research/Prep Agent	Pulls background before meetings/decisions, web search, doc summarization	Web search, Macro MCP docs tools
Device Agent	Executes on-phone actions directly via Termux: notifications, reminders, location-aware nudges, reading/controlling device state	Termux shell + Termux:API + local server (below)
Macro Agent	A thin router into Macro's MCP server, giving every other subagent access to the full ~67-tool surface without each reimplementing Macro-specific logic	Macro MCP server (full tool catalog)

Each subagent is stateless between calls — all durable state lives in the Context Store, not in the agent process. This is what lets any subagent restart cleanly via Flue's Durable Streams, and it's what keeps a fully autonomous system auditable: nothing is "remembered" only inside a process you can't inspect.

4. Flue framework mapping

/cos-project
  /agents
    chief-of-staff.ts       # orchestrator harness config
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
    macro-mcp.md              # Macro MCP server connection + tool catalog notes
    termux-bridge.md          # Termux shell/API/server install + tool bindings
  flue.config.ts

Key Flue mechanics this design leans on:

Harness config per agent — model choice, sandbox type, filesystem/tool access are declared per agent file, so the Comms Agent (needs email send access) is scoped differently from the Research Agent (needs only web search + read-only docs).
parallel() / pipeline() — the CoS uses parallel() for independent fan-out (e.g., "check calendar + triage inbox + review task list" simultaneously) and pipeline() for dependent chains (e.g., "research the person → draft the prep doc → notify me") where a slow step shouldn't block completed fast ones.
Direct execution, no approval wrapper — subagent tool calls (Macro MCP tools, Termux commands) execute immediately as part of the plan. There is no withApproval() gate in this configuration.
Skills as Markdown — your personal preferences (tone for emails, how aggressively to triage, what counts as "urgent," what an agent must never do) live in editable .md skill files, not code, so you can retune behavior without a redeploy.
Durable Streams — every plan step and every tool call is logged as it happens; if a Worker is evicted mid-task, another invocation resumes from the last committed step instead of repeating side effects (important since actions are irreversible once fired).
5. Cloudflare deployment
Concern	Cloudflare primitive	Why
Agent runtime	Workers (via Flue's flue build --target cloudflare)	Each agent (CoS + subagents) deploys as a Worker; Flue handles the harness runtime
Durable session/state	Durable Objects	One DO per "day" or per active plan gives strict ordering and avoids race conditions between subagents writing back results
Long-term memory	D1 (structured: goals, tasks, decision/audit log) + Vectorize (semantic recall over notes, past emails, docs)	Cheap relational store for goals/schedule + vector search for "what did I decide about X three weeks ago"
Fast/session cache	KV	Preferences, current-day context snapshot, guardrail config
Async work / fan-out	Queues	Subagent tasks that don't need an immediate reply (e.g., nightly inbox triage) go through a queue rather than blocking the CoS
Scheduled rituals	Cron Triggers	Daily briefing (morning), daily wrap-up (evening), weekly review (Sunday), monthly goal check-in
Device/webhook ingress	Workers (public HTTPS endpoints)	Receives events from the Termux bridge and from Macro MCP/webhook events
Secrets (API keys, OAuth tokens)	Wrangler secrets / Cloudflare Secrets Store	Macro MCP credentials, Termux pairing keys, never in code
6. Android integration layer — Termux

Termux gives the phone a real Linux userland: a shell, package manager, and (with its add-ons) an HTTP-callable API and the ability to run a persistent local server. That replaces the need for a bespoke companion app — the Device Agent talks to the phone the same way it'd talk to any other remote host.

Components:

Termux — base shell environment; runs the local agent bridge process and any CLI tools the Device Agent needs
Termux:API — exposes device functions (notifications, SMS, location, battery, clipboard, sensors, calendar via termux-* commands) as simple shell calls the bridge can invoke
Termux:Boot — starts the bridge process automatically on device boot/reboot, so the phone stays reachable without manual relaunch
Local bridge server — a small process (e.g., Node/Python) running inside Termux that exposes the termux-* commands over an authenticated HTTP API, and opens an outbound connection (websocket or long-poll) to the Cloudflare Worker ingress so the CoS can reach the phone even across NAT/carrier networks without exposing a public port on-device

What the Device Agent can do directly:

Push native notifications and reminders (termux-notification)
Read/act on calendar, SMS, clipboard, location, battery/sensor state
Trigger phone actions (dialer, share intents, vibration, TTS) via termux-* commands
Run arbitrary shell commands/scripts staged in the bridge for more complex on-device workflows

Security: the Termux bridge authenticates to the Worker with a scoped, rotatable pairing token. Even with full autonomy, the bridge's own command surface should be an explicit allow-list of termux-* invocations plus vetted scripts — not an open shell exposed to the network — so the blast radius of a bad plan is bounded by what commands exist, not by what's theoretically possible on a Linux userland. Every command executed is logged to the same Durable Stream/audit log as every other agent action.

7. Macro.com integration layer — MCP

Macro exposes an MCP server with roughly 67 tools covering its full product surface (mail, chat, docs, tasks, calls, CRM, unified search, automations). Rather than the CoS or any subagent wrapping Macro's REST API by hand, the Macro Agent connects directly to this MCP server and exposes its tool catalog to whichever subagent needs it:

Comms Agent → mail/chat tools (read, draft, send)
Tasks/Projects Agent → task/CRM tools (read, create, update, close)
Calendar/Time Agent → calendar tools (read, create, reschedule, cancel)
Research/Prep Agent → docs/search tools (read-only)
All writes execute directly through MCP — no staging step

Practical notes for the build:

Flue's connector pattern (/connectors/macro-mcp.md) documents the MCP server URL, auth, and any tool-subset restrictions per subagent — you likely don't want every subagent to see all 67 tools; scope each agent's harness config to just the tool namespace it needs.
Pull the live tool list from the MCP server at build time rather than hardcoding it here — tool catalogs on actively developed MCP servers shift, and ~67 is a snapshot count, not a contract.
Macro's own native Automations feature can still be triggered as one of those MCP tools where a Macro-side workflow is a better fit than reimplementing the logic in a subagent.
8. Situational awareness / context layer

The Context Store is what makes this a "chief of staff" rather than a task runner. Schema sketch (D1):


goals(id, horizon[daily|weekly|monthly], domain[personal|professional], text, status, created_at, review_at)
commitments(id, source[macro|termux|manual], type[meeting|task|deadline], when, related_goal_id)
decisions(id, summary, rationale, action_taken, made_at, related_goal_id)
preferences(id, key, value)         -- tone, guardrails, quiet hours, etc.
daily_context(date, summary, open_loops, energy_notes)
Daily briefing: today's commitments, top 3 priorities against active goals, what the CoS already acted on overnight
Weekly review: goal progress, what slipped, what to re-prioritize, generated every Sunday evening
Monthly: personal/professional goal check-in, trend view of where time actually went vs. intended

Vectorize handles fuzzy recall ("what did I promise the Q3 vendor") by embedding daily summaries, decision logs, and Macro doc/email content, so the CoS can ground its planning — and its autonomous actions — in real history instead of only the last few turns.

9. Autonomy & guardrails

With no approval gate, safety shifts from "ask first" to "constrain the tool surface and log everything":

Scoped tools, not scoped judgment. Each subagent's harness only exposes the MCP tools / Termux commands it actually needs — the Comms Agent can't touch CRM records, the Research Agent can't send mail.
Explicit guardrails file (autonomy-guardrails.md). Hard rules the CoS and subagents check before acting — e.g., spend limits, do-not-contact lists, quiet hours for notifications, categories of message that must never be auto-sent. This is a skill file, not code, so you can amend it without a redeploy.
Full audit log. Every MCP tool call and every Termux command is written to the decision/audit log with the reasoning that led to it, in real time — this is your visibility mechanism now that there's no pre-execution checkpoint.
Reversibility bias in planning. Encode in cos-planning.md that, all else equal, the CoS should prefer the more reversible of two ways to accomplish a goal (e.g., propose-and-hold a draft doc vs. send, where sending isn't actually required by the task) — this is a planning preference, not a gate.
10. Example flow — "Prep me for tomorrow"
You message the CoS (chat, or it fires on the evening cron).
CoS reads Context Store for tomorrow's commitments and active goals.
parallel(): Calendar Agent confirms tomorrow's schedule and resolves any conflict directly (via Macro MCP calendar tools) → Comms Agent triages inbox and sends any time-sensitive reply that's within guardrails → Research Agent pulls background on tomorrow's external meeting via Macro MCP CRM/docs tools + web search.
CoS reconciles results and drafts the briefing.
Device Agent pushes the briefing as a native Android notification via the Termux bridge at your preferred time.
All actions taken (rescheduling, replies sent, research pulled) are already logged in the Context Store's decision log for you to review whenever you want — not before they happened.
11. Phased build plan
Foundation: Flue project scaffold, Cloudflare deploy target, Context Store schema, CoS agent with no subagents
Macro MCP integration: connect the Macro Agent to the MCP server, scope tool subsets per future subagent, daily briefing cron (read-only to start, for your own confidence in the plumbing)
Comms/Tasks/Calendar Agents: full read+write via Macro MCP, guardrails file in place before first autonomous send/reschedule
Termux bridge: base shell + Termux:API + Termux:Boot, local bridge server, Device Agent wired to Worker ingress
Research Agent + Vectorize memory: richer meeting prep, historical recall
Guardrail tightening pass: review the audit log after a couple weeks of live autonomous operation, refine autonomy-guardrails.md based on what actually happened
Weekly/monthly review rituals: goal-tracking loop closes
12. Open risks / things to validate before building
Macro's MCP tool catalog should be pulled live at build/connect time — confirm the exact tool list, scopes, and auth model rather than relying on the ~67 figure as a spec
Termux background execution can still be affected by Android's battery/Doze restrictions even with Termux:Boot — prefer the bridge holding an outbound connection over anything requiring the OS to wake it on a schedule
Full autonomy means a bad plan executes before anyone sees it — the guardrails file and audit log are load-bearing, not optional; write and review them before Phase 3 goes live with real sends
Cost/rate limits on Cloudflare Queues + Vectorize, and on Macro's MCP server itself, at your expected action volume