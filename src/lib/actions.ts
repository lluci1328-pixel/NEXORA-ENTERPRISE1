"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import {
  createSession,
  destroySession,
  requireBusinessAccess,
  verifyPassword,
} from "./auth";
import { recordActivity, recordAudit, incrementDailyMetric } from "./activity";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") {
    return { error: "Invalid credentials. Please try again." };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { error: "Invalid credentials. Please try again." };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    isPlatformOwner: user.isPlatformOwner,
  });
  await recordAudit({ userId: user.id, action: "auth.login" });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Inbox — live monitor & human takeover
// ---------------------------------------------------------------------------

export async function takeoverConversationAction(businessSlug: string, conversationId: string) {
  const { user, business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId: business.id },
    include: { contact: true },
  });
  if (!conversation) throw new Error("Conversation not found");

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "HUMAN_TAKEOVER", humanAssigneeId: user.id },
  });
  await recordActivity({
    businessId: business.id,
    type: "HUMAN_TAKEOVER",
    title: `${user.name} took over the conversation`,
    contactId: conversation.contactId,
    actorType: "USER",
    actorUserId: user.id,
  });
  revalidatePath(`/${businessSlug}/inbox`);
}

export async function handBackToAiAction(businessSlug: string, conversationId: string) {
  const { business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  await prisma.conversation.updateMany({
    where: { id: conversationId, businessId: business.id },
    data: { status: "AI_HANDLING", humanAssigneeId: null },
  });
  revalidatePath(`/${businessSlug}/inbox`);
}

export async function sendHumanMessageAction(
  businessSlug: string,
  conversationId: string,
  body: string,
) {
  const { user, business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  const text = body.trim();
  if (!text) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId: business.id },
  });
  if (!conversation) throw new Error("Conversation not found");

  await prisma.message.create({
    data: {
      businessId: business.id,
      conversationId,
      direction: "OUTBOUND",
      senderType: "HUMAN",
      contentType: "TEXT",
      body: text,
      deliveryStatus: "SENT",
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      status: "HUMAN_TAKEOVER",
      humanAssigneeId: user.id,
      unreadCount: 0,
    },
  });
  await incrementDailyMetric(business.id, "HUMAN_MESSAGES");
  revalidatePath(`/${businessSlug}/inbox`);
}

export async function markConversationResolvedAction(
  businessSlug: string,
  conversationId: string,
) {
  const { business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  await prisma.conversation.updateMany({
    where: { id: conversationId, businessId: business.id },
    data: { status: "RESOLVED", unreadCount: 0 },
  });
  revalidatePath(`/${businessSlug}/inbox`);
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

export async function updateLeadStatusAction(
  businessSlug: string,
  leadId: string,
  status: string,
) {
  const { user, business } = await requireBusinessAccess(businessSlug, "AGENT");
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId: business.id },
  });
  if (!lead) throw new Error("Lead not found");

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status,
      convertedAt: status === "CONVERTED" ? new Date() : undefined,
    },
  });
  await recordActivity({
    businessId: business.id,
    type: "LEAD_STATUS_CHANGED",
    title: `Lead status changed to ${status}`,
    contactId: lead.contactId,
    leadId: lead.id,
    actorType: "USER",
    actorUserId: user.id,
  });
  await recordAudit({
    businessId: business.id,
    userId: user.id,
    action: "lead.status_change",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { from: lead.status, to: status },
  });
  revalidatePath(`/${businessSlug}/crm/leads`);
  revalidatePath(`/${businessSlug}/crm/leads/${leadId}`);
}

export async function moveDealStageAction(businessSlug: string, dealId: string, stageId: string) {
  const { user, business } = await requireBusinessAccess(businessSlug, "AGENT");
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId: business.id },
    include: { stage: true },
  });
  if (!deal) throw new Error("Deal not found");
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipeline: { businessId: business.id } },
  });
  if (!stage) throw new Error("Stage not found");

  await prisma.deal.update({ where: { id: deal.id }, data: { stageId: stage.id } });
  await recordActivity({
    businessId: business.id,
    type: "DEAL_STAGE_CHANGED",
    title: `Deal moved: ${deal.stage.name} → ${stage.name}`,
    contactId: deal.contactId,
    dealId: deal.id,
    actorType: "USER",
    actorUserId: user.id,
  });
  revalidatePath(`/${businessSlug}/crm/deals`);
}

export async function markDealOutcomeAction(
  businessSlug: string,
  dealId: string,
  outcome: "WON" | "LOST",
  lostReason?: string,
) {
  const { user, business } = await requireBusinessAccess(businessSlug, "AGENT");
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId: business.id },
  });
  if (!deal) throw new Error("Deal not found");

  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      status: outcome,
      wonAt: outcome === "WON" ? new Date() : undefined,
      lostAt: outcome === "LOST" ? new Date() : undefined,
      lostReason: outcome === "LOST" ? (lostReason ?? "Not specified") : undefined,
    },
  });
  await recordActivity({
    businessId: business.id,
    type: outcome === "WON" ? "DEAL_WON" : "DEAL_LOST",
    title: `Deal ${outcome.toLowerCase()} — ${deal.title}`,
    contactId: deal.contactId,
    dealId: deal.id,
    actorType: "USER",
    actorUserId: user.id,
  });
  await incrementDailyMetric(business.id, outcome === "WON" ? "DEALS_WON" : "DEALS_LOST");
  if (outcome === "WON") {
    await incrementDailyMetric(business.id, "REVENUE", deal.value);
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: "DEAL_WON",
        title: "Deal won 🎉",
        body: `${deal.title} closed by ${user.name}.`,
        priority: "HIGH",
      },
    });
  }
  revalidatePath(`/${businessSlug}/crm/deals`);
}

export async function toggleTaskAction(businessSlug: string, taskId: string) {
  const { user, business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId: business.id } });
  if (!task) throw new Error("Task not found");

  const completed = task.status !== "COMPLETED";
  await prisma.task.update({
    where: { id: task.id },
    data: { status: completed ? "COMPLETED" : "OPEN", completedAt: completed ? new Date() : null },
  });
  if (completed) {
    await recordActivity({
      businessId: business.id,
      type: "TASK_COMPLETED",
      title: `Task completed: ${task.title}`,
      contactId: task.contactId ?? undefined,
      dealId: task.dealId ?? undefined,
      actorType: "USER",
      actorUserId: user.id,
    });
  }
  revalidatePath(`/${businessSlug}/crm/tasks`);
}

export async function addNoteAction(
  businessSlug: string,
  entity: { contactId?: string; dealId?: string },
  body: string,
) {
  const { user, business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  const text = body.trim();
  if (!text) return;
  await prisma.note.create({
    data: {
      businessId: business.id,
      body: text,
      authorUserId: user.id,
      contactId: entity.contactId,
      dealId: entity.dealId,
    },
  });
  await recordActivity({
    businessId: business.id,
    type: "NOTE_ADDED",
    title: `${user.name} added a note`,
    description: text.slice(0, 200),
    contactId: entity.contactId,
    dealId: entity.dealId,
    actorType: "USER",
    actorUserId: user.id,
  });
  revalidatePath(`/${businessSlug}/crm`, "layout");
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markAllNotificationsReadAction(businessSlug: string) {
  const { business } = await requireBusinessAccess(businessSlug, "SUPPORT");
  await prisma.notification.updateMany({
    where: { businessId: business.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath(`/${businessSlug}`, "layout");
}

// ---------------------------------------------------------------------------
// AI Agents
// ---------------------------------------------------------------------------

export async function toggleAgentStatusAction(businessSlug: string, agentId: string) {
  const { user, business } = await requireBusinessAccess(businessSlug, "ADMIN");
  const agent = await prisma.aiAgent.findFirst({
    where: { id: agentId, businessId: business.id },
  });
  if (!agent) throw new Error("Agent not found");
  const nextStatus = agent.status === "PAUSED" ? "ACTIVE" : "PAUSED";
  await prisma.aiAgent.update({ where: { id: agent.id }, data: { status: nextStatus } });
  await recordAudit({
    businessId: business.id,
    userId: user.id,
    action: "agent.status_change",
    entityType: "AiAgent",
    entityId: agent.id,
    metadata: { from: agent.status, to: nextStatus },
  });
  revalidatePath(`/${businessSlug}/agents`);
}
