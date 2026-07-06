# Nexora — Architecture

Nexora is a **multi-tenant Enterprise AI Automation Platform**. One deployment
runs unlimited businesses; each business gets its own AI agents, CRM, knowledge
base, workflows, analytics and team — with hard data isolation between tenants.

This document explains how it is built and, critically, how it scales to new
agents, channels, businesses and integrations **without a rewrite**.

---

## 1. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router, RSC, Server Actions) | One codebase for UI + API; server components keep tenant data on the server. |
| Language | TypeScript (strict) | Type-safe domain model end to end. |
| DB (dev) | SQLite via Prisma driver adapter | Zero-setup local development. |
| DB (prod) | PostgreSQL (swap `provider` + adapter) | Scales; `pgvector` for embeddings. |
| ORM | Prisma 7 | Typed queries; portable schema. |
| AI | Anthropic Claude via a provider abstraction | Swappable; cost-controlled model routing. |
| Automation | n8n (self-hosted friendly, low cost) | Visual workflows; the integration plane. |
| Auth | JWT sessions (jose) + bcrypt, RBAC | Stateless, standard, edge-checkable. |
| UI | Tailwind v4 design tokens + Recharts | Consistent enterprise theme, real charts. |

---

## 2. Multi-tenancy & data isolation

**Every tenant-owned row carries a `businessId`.** Isolation is enforced in
three layers so a bug in one is caught by the next:

1. **Auth gate** — `requireBusinessAccess(slug, minRole)` resolves the user's
   role in that business (platform owners get implicit `OWNER` everywhere) and
   throws `403` otherwise. Every page and API route calls it.
2. **Scoped read layer** — `src/lib/queries.ts` takes a `businessId` and filters
   every query by it. Pages never touch Prisma directly for cross-cutting reads,
   so the isolation guarantee lives in one auditable place.
3. **Scoped writes** — server actions (`src/lib/actions.ts`) and webhooks
   re-verify ownership (`findFirst({ where: { id, businessId } })`) before any
   mutation, so an id from one tenant can never mutate another's data.

```
User ──< Membership >── Business ──< everything (businessId FK) >──
                 (role: OWNER|ADMIN|MANAGER|AGENT|SUPPORT)
```

A `User` can belong to many businesses with different roles. A **platform
owner** (`isPlatformOwner`) sees the whole portfolio (`/` overview).

---

## 3. Who uses the system (roles)

| Role | Rank | Can do |
|------|------|--------|
| **Owner** | 5 | Everything; portfolio view across all businesses; billing. |
| **Admin** | 4 | Manage this business — team, agents, integrations, settings, data. |
| **Manager** | 3 | Sales oversight — pipelines, team performance, all CRM. |
| **Agent** (Sales) | 2 | Work assigned leads, deals, conversations. |
| **Support** | 1 | Handle support conversations, human takeover, tasks. |

`ROLE_RANK` gates actions: e.g. toggling an AI agent requires `ADMIN`, editing a
lead requires `AGENT`, taking over a chat requires `SUPPORT`. Machine callers
(n8n) authenticate with **scoped API keys** (`ApiKey`, SHA-256 hashed) instead
of sessions.

---

## 4. The AI layer (multi-agent)

Ten **specialized agents** per business, not one monolith
(`src/lib/ai/agents.ts`):

Reception · Sales · Support · Voice · Follow-up · Lead Qualification ·
Appointment · CRM · Knowledge · Analytics

### Provider abstraction (`src/lib/ai/provider.ts`)
The platform only talks to an `LlmProvider` interface. Today it's Anthropic
Claude; adding a provider or routing cheap tasks (extraction, scoring) to a
cheaper model is a one-file change. If no API key is present, `getLlmProvider()`
returns `null` and the system **degrades honestly** — it never fabricates output.

### Orchestrator (`src/lib/ai/orchestrator.ts`)
The production pipeline behind every inbound message:

```
Inbound message
   → upsert Contact + Conversation + Lead        (deterministic, always runs)
   → Reception Agent        (intent routing)
   → Knowledge retrieval    (RAG over this tenant's documents)
   → Specialist Agent       (Sales / Support / Appointment reply)
   → CRM Agent              (extract summary, sentiment, budget)
   → Lead Qualification     (score 0–100, notify on hot leads)
   → activities · metrics · notifications
```

Every agent step is persisted as an **`AgentRun`** — this is what powers the AI
performance analytics and the per-contact "which AI messaged them, and when"
history the CRM shows.

### Retrieval (`src/lib/ai/retrieval.ts`)
RAG over `KnowledgeChunk` rows, scoped by `businessId`. Dev uses lexical scoring
(zero cost); the interface is embedding-ready, so production swaps in `pgvector`
similarity search **without touching any caller**.

---

## 5. Extensibility — adding things without a rewrite

The whole system is built around registries and string-constant enums
(`src/lib/constants.ts`), so growth is additive:

| Add a new… | How | Rewrite? |
|------------|-----|----------|
| **Business** | Insert a `Business` row + seed its agents/pipeline. Architecture is already N-tenant. | No |
| **AI Agent** | Add a blueprint to `AGENT_BLUEPRINTS`; it's seeded per business and appears in the UI. | No |
| **Channel** | Add to `CHANNEL_TYPES`; the orchestrator is channel-agnostic (it keys off `channelType`). | No |
| **Integration** | Add to `INTEGRATION_PROVIDERS`; store creds encrypted on `Integration`. | No |
| **Workflow** | Create a `Workflow` row (visualized in-app) + an n8n JSON. | No |
| **Metric / analytics** | Add a `MetricKey`; `incrementDailyMetric` and charts pick it up. | No |

Because reads go through `queries.ts` and writes through `actions.ts`/webhooks,
new surfaces reuse the same tenant-safe primitives.

---

## 6. Request / data flow

```
Browser ──(session cookie)──► proxy.ts (auth gate)
   │
   ├─ Server Component ──► requireBusinessAccess ──► queries.ts ──► Prisma ──► DB
   │
   └─ Server Action ─────► requireBusinessAccess ──► actions.ts ──► Prisma ──► DB
                                                         │
                                                    recordActivity / audit / metrics

n8n / channels ──(Bearer API key)──► /api/webhooks/* ──► requireApiKey
                                                         │
                                             orchestrator / call & run handlers
```

---

## 7. Security posture

- **Sessions**: httpOnly, `sameSite=lax`, `secure` in production, 7-day JWT.
- **Passwords**: bcrypt (cost 10).
- **API keys**: shown once, stored SHA-256 hashed, scoped, revocable.
- **Integration secrets**: stored in `encryptedCredentials`, never returned by APIs.
- **Audit trail**: `AuditLog` records every sensitive mutation (who, what, when, IP).
- **Input validation**: all webhook payloads validated with Zod.
- **Tenant isolation**: enforced at auth, read, and write layers (section 2).

---

## 8. Path to production

1. Set `provider = "postgresql"` in `schema.prisma`, swap the driver adapter to
   `@prisma/adapter-pg` in `src/lib/db.ts`, run `prisma migrate deploy`.
2. Move `KnowledgeChunk.embeddingJson` to a `pgvector` column; swap the body of
   `retrieveKnowledge` (interface stays identical).
3. Set `AUTH_SECRET` and `ANTHROPIC_API_KEY`; connect real channels via the n8n
   workflows in `/workflows`.
4. Put a background queue (e.g. BullMQ) in front of the orchestrator for
   high-volume tenants; the orchestrator function is already side-effect
   contained and queue-friendly.
