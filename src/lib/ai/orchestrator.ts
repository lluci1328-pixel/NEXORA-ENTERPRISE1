import { prisma } from "../db";
import { recordActivity } from "../activity";
import { incrementDailyMetric } from "../activity";
import type { AgentType, ChannelType } from "../constants";
import { getLlmProvider, isAiConfigured } from "./provider";
import { renderPrompt } from "./agents";
import { formatKnowledgeContext, retrieveKnowledge } from "./retrieval";

/**
 * Multi-agent orchestrator — the production pipeline behind every inbound
 * message:
 *
 *   Inbound → Contact/Conversation upsert → Reception Agent (intent routing)
 *   → Knowledge retrieval → Specialist Agent (reply) → CRM Agent (extraction)
 *   → Lead Qualification Agent (scoring) → activities, metrics, notifications
 *
 * Every agent step is persisted as an AgentRun, which powers the AI
 * performance analytics and the per-contact "AI messaged them on..." history.
 *
 * When no LLM API key is configured the pipeline still performs all
 * deterministic CRM steps, then parks the conversation for a human and says
 * so honestly — it never fabricates an AI reply.
 */

export interface InboundMessageInput {
  businessId: string;
  channelType: ChannelType;
  fromPhone?: string;
  fromEmail?: string;
  fromName?: string;
  contentType?: string; // TEXT | IMAGE | AUDIO | VIDEO | DOCUMENT | VOICE_NOTE
  body: string;
  mediaUrl?: string;
}

export interface OrchestratorResult {
  status: "REPLIED" | "AI_NOT_CONFIGURED" | "ESCALATED";
  conversationId: string;
  contactId: string;
  reply?: string;
  intent?: string;
  leadScore?: number;
}

interface AgentContext {
  businessId: string;
  businessName: string;
  industry: string;
}

/** Loads the agent row and executes one LLM completion, recording an AgentRun. */
async function runAgent(
  ctx: AgentContext,
  type: AgentType,
  userContent: string,
  opts: { conversationId?: string; leadId?: string; contactId?: string; action: string },
): Promise<{ text: string; agentId: string } | null> {
  const agent = await prisma.aiAgent.findUnique({
    where: { businessId_type: { businessId: ctx.businessId, type } },
  });
  if (!agent || agent.status === "PAUSED") return null;

  const provider = getLlmProvider();
  if (!provider) return null;

  const started = Date.now();
  try {
    const result = await provider.complete({
      system: renderPrompt(agent.systemPrompt, {
        businessName: ctx.businessName,
        industry: ctx.industry,
      }),
      messages: [{ role: "user", content: userContent }],
      model: agent.model,
      temperature: agent.temperature,
    });

    await prisma.agentRun.create({
      data: {
        businessId: ctx.businessId,
        agentId: agent.id,
        action: opts.action,
        status: "COMPLETED",
        conversationId: opts.conversationId,
        leadId: opts.leadId,
        contactId: opts.contactId,
        inputSummary: userContent.slice(0, 300),
        outputSummary: result.text.slice(0, 300),
        tokensUsed: result.inputTokens + result.outputTokens,
        durationMs: Date.now() - started,
      },
    });

    if (agent.status === "AWAITING_API_KEY") {
      await prisma.aiAgent.update({ where: { id: agent.id }, data: { status: "ACTIVE" } });
    }

    return { text: result.text, agentId: agent.id };
  } catch (error) {
    await prisma.agentRun.create({
      data: {
        businessId: ctx.businessId,
        agentId: agent.id,
        action: opts.action,
        status: "FAILED",
        conversationId: opts.conversationId,
        inputSummary: userContent.slice(0, 300),
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return null;
  }
}

function safeParseJson<T>(text: string): T | null {
  // Agents are instructed to return strict JSON, but we defend against
  // occasional fenced or prefixed output.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export async function processInboundMessage(
  input: InboundMessageInput,
): Promise<OrchestratorResult> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: input.businessId },
  });
  const ctx: AgentContext = {
    businessId: business.id,
    businessName: business.name,
    industry: business.industry,
  };

  // --- 1. Upsert contact -----------------------------------------------
  let contact = await prisma.contact.findFirst({
    where: {
      businessId: business.id,
      OR: [
        ...(input.fromPhone ? [{ phone: input.fromPhone }, { whatsapp: input.fromPhone }] : []),
        ...(input.fromEmail ? [{ email: input.fromEmail }] : []),
      ],
    },
  });
  const isNewContact = !contact;
  if (!contact) {
    const [firstName, ...rest] = (input.fromName ?? "Unknown Contact").split(" ");
    contact = await prisma.contact.create({
      data: {
        businessId: business.id,
        firstName: firstName || "Unknown",
        lastName: rest.join(" ") || null,
        phone: input.fromPhone,
        whatsapp: input.channelType === "WHATSAPP" ? input.fromPhone : undefined,
        email: input.fromEmail,
        source: input.channelType,
      },
    });
    await recordActivity({
      businessId: business.id,
      type: "CONTACT_CREATED",
      title: `New contact from ${input.channelType}`,
      contactId: contact.id,
      actorType: "SYSTEM",
    });
  }

  // --- 2. Find or open conversation -------------------------------------
  let conversation = await prisma.conversation.findFirst({
    where: {
      businessId: business.id,
      contactId: contact.id,
      channelType: input.channelType,
      status: { in: ["OPEN", "AI_HANDLING", "HUMAN_TAKEOVER"] },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        channelType: input.channelType,
        status: "AI_HANDLING",
      },
    });
  }

  // --- 3. Persist the inbound message ------------------------------------
  await prisma.message.create({
    data: {
      businessId: business.id,
      conversationId: conversation.id,
      direction: "INBOUND",
      senderType: "CUSTOMER",
      contentType: input.contentType ?? "TEXT",
      body: input.body,
      mediaUrl: input.mediaUrl,
      deliveryStatus: "DELIVERED",
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
  });
  await incrementDailyMetric(business.id, "CONVERSATIONS", isNewContact ? 1 : 0);

  // --- 4. Ensure an open lead exists --------------------------------------
  let lead = await prisma.lead.findFirst({
    where: {
      businessId: business.id,
      contactId: contact.id,
      status: { in: ["NEW", "CONTACTED", "QUALIFIED"] },
    },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        title: `${input.channelType} inquiry — ${contact.firstName}`,
        source: input.channelType === "WEBSITE_CHAT" ? "WEBSITE" : input.channelType,
        status: "NEW",
      },
    });
    await recordActivity({
      businessId: business.id,
      type: "LEAD_CREATED",
      title: `Lead created from ${input.channelType} message`,
      contactId: contact.id,
      leadId: lead.id,
      actorType: "SYSTEM",
    });
    await incrementDailyMetric(business.id, "NEW_LEADS");
  }

  // If a human has taken over, the AI stays silent by design.
  if (conversation.status === "HUMAN_TAKEOVER") {
    return {
      status: "ESCALATED",
      conversationId: conversation.id,
      contactId: contact.id,
    };
  }

  // --- 5. AI pipeline ------------------------------------------------------
  if (!isAiConfigured()) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "OPEN" },
    });
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: "SYSTEM",
        title: "Message waiting — AI provider not configured",
        body: `${contact.firstName} sent a ${input.channelType} message. Add your Anthropic API key in Settings → Integrations to enable AI replies.`,
        priority: "HIGH",
      },
    });
    return {
      status: "AI_NOT_CONFIGURED",
      conversationId: conversation.id,
      contactId: contact.id,
    };
  }

  // Recent history for context
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const historyText = history
    .reverse()
    .map((m) => `${m.senderType === "CUSTOMER" ? "Customer" : "Agent"}: ${m.body}`)
    .join("\n");

  // 5a. Reception Agent — intent routing
  const receptionOut = await runAgent(ctx, "RECEPTION", `Conversation so far:\n${historyText}`, {
    conversationId: conversation.id,
    contactId: contact.id,
    action: "ROUTE_CONVERSATION",
  });
  const routing = receptionOut
    ? safeParseJson<{ intent: string; reply: string; urgency: string }>(receptionOut.text)
    : null;
  const intent = routing?.intent ?? "GENERAL";

  // 5b. Knowledge retrieval for the specialist
  const knowledge = await retrieveKnowledge(business.id, input.body, 5);
  const knowledgeContext = formatKnowledgeContext(knowledge);

  // 5c. Specialist reply
  const specialistType: AgentType =
    intent === "SUPPORT" ? "SUPPORT" : intent === "APPOINTMENT" ? "APPOINTMENT" : "SALES";
  const specialistOut = await runAgent(
    ctx,
    specialistType,
    `Knowledge context:\n${knowledgeContext}\n\nConversation so far:\n${historyText}\n\nWrite the next reply to the customer.`,
    {
      conversationId: conversation.id,
      contactId: contact.id,
      leadId: lead.id,
      action: "REPLY_MESSAGE",
    },
  );

  if (!specialistOut) {
    // Provider/agent failure — park for a human rather than dropping the customer.
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "OPEN" },
    });
    return {
      status: "AI_NOT_CONFIGURED",
      conversationId: conversation.id,
      contactId: contact.id,
    };
  }

  let replyText = specialistOut.text;
  const escalate = replyText.includes("[ESCALATE_TO_HUMAN]");
  replyText = replyText.replace("[ESCALATE_TO_HUMAN]", "").trim();
  // Appointment agent replies in JSON — unwrap for the customer.
  if (specialistType === "APPOINTMENT") {
    const appt = safeParseJson<{ action: string; reply: string; scheduledAt?: string; title?: string }>(replyText);
    if (appt) {
      replyText = appt.reply;
      if (appt.action === "BOOK" && appt.scheduledAt) {
        await prisma.appointment.create({
          data: {
            businessId: business.id,
            contactId: contact.id,
            title: appt.title ?? "Appointment",
            type: "MEETING",
            scheduledAt: new Date(appt.scheduledAt),
            bookedByType: "AI_AGENT",
            status: "SCHEDULED",
          },
        });
        await recordActivity({
          businessId: business.id,
          type: "APPOINTMENT_BOOKED",
          title: "Appointment booked by AI",
          contactId: contact.id,
          leadId: lead.id,
          actorType: "AI_AGENT",
          actorAgentId: specialistOut.agentId,
        });
        await incrementDailyMetric(business.id, "APPOINTMENTS");
      }
    }
  }

  await prisma.message.create({
    data: {
      businessId: business.id,
      conversationId: conversation.id,
      direction: "OUTBOUND",
      senderType: "AI_AGENT",
      senderAgentId: specialistOut.agentId,
      contentType: "TEXT",
      body: replyText,
      deliveryStatus: "SENT",
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status: escalate ? "HUMAN_TAKEOVER" : "AI_HANDLING",
      aiAgentId: specialistOut.agentId,
    },
  });
  await incrementDailyMetric(business.id, "AI_MESSAGES");
  await recordActivity({
    businessId: business.id,
    type: "MESSAGE_SENT",
    title: `AI replied on ${input.channelType}`,
    description: replyText.slice(0, 200),
    contactId: contact.id,
    leadId: lead.id,
    actorType: "AI_AGENT",
    actorAgentId: specialistOut.agentId,
  });

  if (escalate) {
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: "HUMAN_TAKEOVER_REQUESTED",
        title: "Human takeover requested",
        body: `Support Agent escalated the conversation with ${contact.firstName}.`,
        priority: "HIGH",
      },
    });
  }

  // 5d. CRM Agent — structured extraction (summary, sentiment, budget)
  const crmOut = await runAgent(
    ctx,
    "CRM",
    `Conversation:\n${historyText}\nCustomer: ${input.body}\nAgent: ${replyText}`,
    {
      conversationId: conversation.id,
      contactId: contact.id,
      leadId: lead.id,
      action: "UPDATE_CRM",
    },
  );
  if (crmOut) {
    const extraction = safeParseJson<{
      contact?: { firstName?: string; lastName?: string; email?: string; phone?: string };
      lead?: { budget?: number; requirement?: string };
      summary?: string;
      sentiment?: string;
    }>(crmOut.text);
    if (extraction) {
      if (extraction.summary || extraction.sentiment) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { aiSummary: extraction.summary, sentiment: extraction.sentiment },
        });
      }
      if (extraction.lead?.budget || extraction.lead?.requirement) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            budget: extraction.lead.budget ?? undefined,
            requirement: extraction.lead.requirement ?? undefined,
            status: lead.status === "NEW" ? "CONTACTED" : undefined,
          },
        });
      }
      if (extraction.contact?.firstName && contact.firstName === "Unknown") {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            firstName: extraction.contact.firstName,
            lastName: extraction.contact.lastName ?? undefined,
            email: extraction.contact.email ?? undefined,
          },
        });
      }
    }
  }

  // 5e. Lead Qualification Agent — scoring
  let leadScore: number | undefined;
  const qualOut = await runAgent(
    ctx,
    "LEAD_QUALIFICATION",
    `Lead data: ${JSON.stringify({ title: lead.title, budget: lead.budget, requirement: lead.requirement, source: lead.source })}\nConversation:\n${historyText}`,
    {
      conversationId: conversation.id,
      contactId: contact.id,
      leadId: lead.id,
      action: "QUALIFY_LEAD",
    },
  );
  if (qualOut) {
    const qual = safeParseJson<{
      score: number;
      factors: { factor: string; points: number; detail: string }[];
      recommendation: string;
    }>(qualOut.text);
    if (qual && typeof qual.score === "number") {
      leadScore = Math.max(0, Math.min(100, Math.round(qual.score)));
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          score: leadScore,
          scoreFactorsJson: JSON.stringify(qual.factors ?? []),
          qualifiedByAi: true,
          status: leadScore >= 70 ? "QUALIFIED" : undefined,
        },
      });
      if (leadScore >= 70) {
        await incrementDailyMetric(business.id, "LEADS_QUALIFIED");
        await recordActivity({
          businessId: business.id,
          type: "LEAD_QUALIFIED",
          title: `Lead qualified by AI — score ${leadScore}/100`,
          contactId: contact.id,
          leadId: lead.id,
          actorType: "AI_AGENT",
        });
      }
      if (leadScore >= 85) {
        await prisma.notification.create({
          data: {
            businessId: business.id,
            type: "HIGH_VALUE_LEAD",
            title: `Hot lead: ${contact.firstName} (${leadScore}/100)`,
            body: qual.recommendation
              ? `Recommendation: ${qual.recommendation}. ${lead.requirement ?? ""}`
              : "High-intent lead detected by the Lead Qualification Agent.",
            priority: "CRITICAL",
          },
        });
      }
    }
  }

  return {
    status: escalate ? "ESCALATED" : "REPLIED",
    conversationId: conversation.id,
    contactId: contact.id,
    reply: replyText,
    intent,
    leadScore,
  };
}
