# Nexora n8n Workflows

These are **production-shaped, importable** n8n workflows that connect external
channels (WhatsApp, telephony, email) to the Nexora platform. They are the
automation layer — the "heart" of the product. Nexora owns the AI reasoning and
the data; n8n owns the plumbing between systems.

> Where is the AI agent workflow in the app?
> Open any business → **Workflows** in the sidebar (`/<business>/workflows`).
> Each card opens a **visual pipeline viewer** showing every step. The
> definitions there mirror these JSON files. Run history, success rate and
> average duration are populated live via `POST /api/webhooks/workflows/runs`.

## Files

| File | Trigger | What it does |
|------|---------|--------------|
| `whatsapp-omnichannel-pipeline.json` | Inbound WhatsApp message | Detects media type, (optionally) transcribes audio, runs Nexora's full multi-agent pipeline, sends the AI reply back. |
| `instant-lead-response-call.json` | New web/campaign lead | Waits 2 minutes, then places an outbound Voice Agent qualification call. |
| `smart-followup-sequence.json` | Hourly schedule | Sends Day 1 / 3 / 7 personalized follow-ups; stops the instant the customer replies. |
| `daily-executive-briefing.json` | Daily 08:00 | Analytics Agent compiles yesterday's metrics into a briefing, sent to the owner on WhatsApp + email. |

## Import

1. In n8n: **Workflows → Import from File** and select a JSON file.
2. Create an **Header Auth** credential named `Nexora API` with:
   - Name: `Authorization`
   - Value: `Bearer <your Nexora API key>` (Settings → API Keys in the app;
     demo key format: `nxk_demo_<business_slug>_...`).
3. Set the environment variables below in n8n (**Settings → Variables** or host env).
4. Attach the `Nexora API` credential to every **HTTP Request** node that calls
   `NEXORA_BASE_URL`.
5. Activate the workflow.

## Environment variables

| Variable | Example | Used by |
|----------|---------|---------|
| `NEXORA_BASE_URL` | `https://app.yourdomain.com` | all |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` | WhatsApp send, briefing |
| `OWNER_WHATSAPP` | `+919876543210` | briefing |
| `OWNER_EMAIL` | `owner@company.com` | briefing |
| `VOICE_PROVIDER_URL` | `https://api.vapi.ai` | instant call |
| `TRANSCRIPTION_URL` | `https://api.openai.com/v1/audio/transcriptions` | WhatsApp media |

## How a message flows (WhatsApp pipeline)

```
WhatsApp Cloud API
        │  (inbound webhook)
        ▼
Detect Message Type ──► [audio/voice] Transcribe ──┐
        │                                          │
        └──────────────► Nexora AI Orchestrator ◄──┘
                          POST /api/webhooks/messages/inbound
                                   │
        Nexora runs, in one call:  │
        Reception → Knowledge → Sales/Support → CRM → Lead Qualification
                                   │
                          { status, reply, intent, leadScore }
                                   │
                          AI Produced a Reply? ──► Send WhatsApp Reply
                                   │
                          Acknowledge Webhook
```

The heavy lifting (routing, retrieval, reply, extraction, scoring, appointment
booking, notifications, analytics) happens **inside Nexora** so the same logic
works for every channel — n8n just carries the message in and the reply out.

## Note on the AI provider

Without an `ANTHROPIC_API_KEY` set in Nexora, the orchestrator still runs every
deterministic step (creates the contact, conversation, lead, notifications) and
returns `status: "AI_NOT_CONFIGURED"` — it never fabricates an AI reply. Add the
key and the exact same workflow starts returning real AI replies. Drop the key
into a live workflow and it works end to end.
