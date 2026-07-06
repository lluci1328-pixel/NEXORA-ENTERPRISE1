# Nexora — Enterprise AI Automation Platform

Run **every business** on one intelligent platform. Nexora gives each business a
team of specialized AI agents, an omnichannel inbox, an enterprise CRM (Pulse
CRM), voice AI, a knowledge base (RAG), production automation workflows and
real-time analytics — all fully isolated per tenant, managed from one dashboard.

Not a chatbot. A multi-tenant SaaS platform designed to be sold to enterprise
clients.

![Nexora](https://img.shields.io/badge/status-demo%20build-2563eb) ![tenancy](https://img.shields.io/badge/architecture-multi--tenant-059669)

---

## What's inside

- **Portfolio command center** — one login, all businesses at a glance.
- **10 specialized AI agents** per business (Reception, Sales, Support, Voice,
  Follow-up, Lead Qualification, Appointment, CRM, Knowledge, Analytics) that
  share context through a real orchestration pipeline.
- **Omnichannel inbox** with a **live conversation monitor** and one-click
  **human takeover**.
- **Pulse CRM** — leads (AI-scored 0–100), contacts, companies, a drag-and-drop
  **deal kanban**, tasks, appointments, notes, tags, custom fields, per-record
  timeline and AI summaries.
- **Voice AI** — inbound/outbound calls with recordings, transcripts, AI
  summaries, outcomes and human transfer.
- **Knowledge base (RAG)** — PDFs, catalogs, FAQs, policies; agents answer
  grounded in your documents with sources.
- **Workflows** — production n8n automations with an in-app **visual pipeline
  viewer** and live run history.
- **Analytics** — revenue, conversion, lead sources, AI performance, call
  outcomes, team performance.
- **Enterprise foundations** — RBAC (5 roles), scoped API keys, audit log,
  per-tenant data isolation.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design and how it scales
to new agents/channels/businesses without a rewrite.

---

## Quick start

```bash
npm install
npm run db:push      # create the SQLite dev database from the schema
npm run db:seed      # load 5 demo businesses with rich, realistic data
npm run dev          # http://localhost:3000
```

> Requires Node.js 20.9+.

### Log in

| Who | Email | Password |
|-----|-------|----------|
| Platform Owner (sees all 5 businesses) | `owner@nexora.app` | `Nexora@2026` |
| Business staff | `<name>@<business-slug>.demo` | `Nexora@2026` |

Business slugs: `skyline-realty` (Real Estate — deepest data), `azure-grand-hotel`,
`saffron-house` (Restaurant), `medicare-plus-clinic`, `brightpath-academy`.

---

## Turning on the AI (optional, but recommended)

The platform runs fully without an AI key — but AI replies are then **queued for
a human** and clearly marked; nothing is faked. To go live:

```bash
# .env
ANTHROPIC_API_KEY="sk-ant-..."
```

Now the multi-agent orchestrator produces real replies, lead scores, CRM
extraction and briefings. The same code path powers the n8n workflows — drop the
key in and it works end to end.

---

## Connecting channels (n8n)

Importable, production-shaped workflows live in **[`/workflows`](./workflows)**
(WhatsApp omnichannel pipeline, instant lead call, smart follow-up sequence,
daily executive briefing). See [`workflows/README.md`](./workflows/README.md)
for import steps and environment variables.

External systems call Nexora over authenticated webhooks:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/messages/inbound` | Run the multi-agent pipeline on a customer message |
| `POST /api/webhooks/calls/completed` | Record a voice call + update CRM/analytics |
| `POST /api/webhooks/workflows/runs` | Report n8n run status (drives workflow analytics) |
| `GET  /api/health` | Liveness + AI-configured status |

Auth: `Authorization: Bearer <API key>` (Settings → API Keys). Demo key format:
`nxk_demo_<business_slug>_2f8a91c4d7e3b6a5`.

Example:

```bash
curl -X POST http://localhost:3000/api/webhooks/messages/inbound \
  -H "Authorization: Bearer nxk_demo_skyline_realty_2f8a91c4d7e3b6a5" \
  -H "Content-Type: application/json" \
  -d '{"channelType":"WHATSAPP","fromPhone":"+919876543210","fromName":"Amit","body":"Looking for a 3BHK near SG Highway under 90 lakh"}'
```

---

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync schema → SQLite dev DB |
| `npm run db:seed` | Reseed demo data |
| `npm run db:studio` | Open Prisma Studio |

---

## Going to production

PostgreSQL + `pgvector`, real channel credentials, `AUTH_SECRET` and
`ANTHROPIC_API_KEY`. Step-by-step in [ARCHITECTURE.md § 8](./ARCHITECTURE.md).

---

## Project layout

```
prisma/schema.prisma      # multi-tenant data model
prisma/seed.ts            # 5 demo businesses, rich data
src/lib/                  # db, auth, tenancy, actions, queries, activity
src/lib/ai/               # provider abstraction, agents, orchestrator, RAG
src/app/                  # login, portfolio, /[business]/* dashboard + API routes
src/components/           # design-system primitives, charts, layout
workflows/                # importable n8n workflows + guide
```
