---
title: Flue-based CoS Design — Review
id: professional/ideas/flue-co-s-design-review
type: note
category: professional
updated: 2026-09-05
status: draft
tags: [design, flue, cos]
tools: [flue, macro, termux]
---

Review date: 2026-09-05. Input: `flue-artifact-co-s-architecture-v0.2.md` ("Personal Chief of Staff — Architecture Plan, Draft v0.2").
Stack under review: **Flue (agent harness) → Cloudflare Workers / Agents SDK**, with Termux (Android) and Macro.com MCP (~67 tools) as the action surfaces. Verdict first: **architecture is sound and maps cleanly onto what we already operate today; the burst of risk is in the "full autonomy, no approval gate" posture, the Termux bridge surface, and a context store that would drift from stores we already own.**

---

## 1. What's right (and matches reality we've already validated)

1. **One brain + subagent bench = the operating model we run now.** Our CoS today: one context (pass + `context/` + `skills/` + `jobs/`), delegated work, decision capture. The artifact formalizes exactly this.
2. **Harness-first (skills over code).** Behavior in `SKILL.md`/skill files, not hardcoded prompts — this is our `skills/` convention; editable without redeploy = the right tuning loop.
3. **Durable, append-only execution.** Durable Streams + resumable runs directly answer the incident we had: the AutoTask SMS that returned `ok:true` at the brain layer and never hit the modem. An append-only audit trail with replay is the correct load-bearing design for "acted on your behalf."
4. **The two surfaces are the ones we proved.** Macro MCP (verified live: `macro-tools` v0.1.0, 67 tools, `search_docs`/facets working) and Termux device layer (verified: `termux-sms-send`, sshd bridge) are real, working integrations — not hypotheticals.
5. **Phased plan with read-only start.** Phase 1-2 "read-only to start" is the right instinct and is the recommendation I'd shave down to below.

## 2. Critique — the load-bearing risks

### 2.1 "Full autonomy, no human-in-the-loop gating" is wrong as a default
This contradicts the operating policy in force for this CoS (confirm before external side effects: sends, purchasing, bookings, account changes) and was the shape of the SMS failure — a *silent* execution never surfaced for review. "Log it, don't gate it" only works after trust is earned, and the doc's own guardrails are deferred to Phase 3.
**Change:** replace "no approval gate" with an **approval matrix by action class** (default approve: reads, drafts, reminders, file writes to the knowledge base; confirm: send-to-anyone, delete, spend, book, credential change). Autonomy = approved *standing rules*, not unmitigated execution. Keep audit log always-on either way.

### 2.2 The Termux bridge is a high-risk surface and seen as a detail
`Device Agent executes on-phone actions via Termux` — that's arbitrary shell on Derrick's device. Today this is an SSH daemon bound on LAN (port 8022 + saved key). As designed it's the Crown Jewel for an attacker and a single footgun for the agent.
- Scope it: a command allow-list (only `termux-sms-send`-family, notification, forensics); no general `bash` identity in the bridge.
- Do not expose sshd beyond the LAN; use **Cloudflare Tunnel/WireGuard** outbound so the Worker reaches the device without a listening port.
- Per-device secrets and key rotation; log every command with caller agent id.

### 2.3 The Context Store threatens a second brain
D1 + Vectorize + KV is a real stack, but "one context layer" will drift from the system that is the source of truth today: **the git repo + Blume site + knowledge-graph.json** (id/type/facet contract already live). Two brains = contradictions, which is exactly the failure mode the doc claims to avoid.
- Delegate: **long-term/memories → git knowledge base** (already typed + graph exportable); **runtime state + audit = D1/KV-backed Flue streams**; **Vectorize embeddings over the SAME knowledge-graph.json + llms-full.txt** for recall. Map `pass` for secrets; never sync secrets into D1.
- Keep `id`/`type`/`category`/`status`/`tags` as the shared schema between the knowledge base and the store.

### 2.4 Concurrency = action races
Parallel subagents with real write tools (reschedule + email + CRM update concurrently) mutate shared entities; the "audit log" only records the outcome.
- Single-writer lock per entity (per contact/deal/event) or serialize per entity in the Worker; ormerge plans before execution.

## 3. What's missing from v0.2

- **Incident response:** what halts a run? (tripwire = guardrail match stops further actions, alarm to human). Missing.
- **Model choice / cost bounds** per agent (Cloudflare Workers AI vs gateway; per-agent token budgets).
- **PII hygiene in logs:** Termux commands and MCP payloads embed personal data; define redaction at log-write.
- **Macro auth** works, but the server's OAuth metadata is spec-broken (missing RFC 9728 `resource`); token refresh + key rotation path should be designed-in (we run the manual PKCE workaround today).
- **Channel identity:** who is "you" (Telegram, Push) — harden identity/authentication of human instructions at the ingress.

## 4. Suggested delta to v0.2 (concrete)

1. Rename "Autonomy: Full" → "**Autonomy: Approval-matrix default; escalate by class**" (classes + default table in `autonomy-guardrails.md`).
2. **Phase order change:** (0) scaffold on Flue; (1) read-only Macro integration + nightly briefing cron (existing morning-briefing content flow!); (2) audit-log viewer + tripwire; (3) Termux bridge with allow-list + tunneled transport; (4) comms/tasks agents read-only; **(5) plans & guardrails review gate**; then (6) first write surfaces (sends) per class.
3. Context store = façade over existing stores (pass / git / knowledge-graph.json; D1 with runtime + audit; Vectorize on the same artifacts).
4. Wire decisions log to what we already do: every meaningful action keeps an entry in a `decisions` surface (like the existing `context/` audit), plus Durable Streams replay.
5. Use knowledge-graph facets: subagents retrieve context via the MCP `search_docs`(filters) path the site already exposes — fewer bespoke store reads.

## 5. Bottom line

Adopt — after editing: the three fixes I'd demand before any write: approval-matrix default, allow-listed+outbound Termux bridge, and context-layering that reuses the git knowledge base instead of cloning it. Then the phased plan is right and near-darn buildable on the exact surfaces we've already proven. The artifact, stored here, is v0.2; mark it "v0.3 — CoS review applied".

---

*Filed: /Users/hodgeluke/Code/cos-knowledge/Ideas/ (gitignored; not published).*