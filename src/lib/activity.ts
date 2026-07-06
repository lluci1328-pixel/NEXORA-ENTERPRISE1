import { prisma } from "./db";
import type { ActivityType } from "./constants";

interface RecordActivityInput {
  businessId: string;
  type: ActivityType;
  title: string;
  description?: string;
  actorType?: "AI_AGENT" | "USER" | "SYSTEM" | "CUSTOMER";
  actorUserId?: string;
  actorAgentId?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
  metadata?: Record<string, unknown>;
}

/** Appends one event to the unified CRM timeline. */
export async function recordActivity(input: RecordActivityInput) {
  return prisma.activity.create({
    data: {
      businessId: input.businessId,
      type: input.type,
      title: input.title,
      description: input.description,
      actorType: input.actorType ?? "SYSTEM",
      actorUserId: input.actorUserId,
      actorAgentId: input.actorAgentId,
      contactId: input.contactId,
      leadId: input.leadId,
      dealId: input.dealId,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}

interface AuditInput {
  businessId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/** Writes to the enterprise audit trail. Call for every sensitive mutation. */
export async function recordAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      ipAddress: input.ipAddress,
    },
  });
}

/** Bumps (upserts) a daily metric — analytics stay pre-aggregated and cheap. */
export async function incrementDailyMetric(
  businessId: string,
  metric: string,
  amount = 1,
  date = new Date(),
) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return prisma.dailyMetric.upsert({
    where: { businessId_date_metric: { businessId, date: day, metric } },
    create: { businessId, date: day, metric, value: amount },
    update: { value: { increment: amount } },
  });
}
