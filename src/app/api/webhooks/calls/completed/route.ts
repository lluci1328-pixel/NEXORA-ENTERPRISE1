import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiAuthError, requireApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { incrementDailyMetric, recordActivity } from "@/lib/activity";

/**
 * POST /api/webhooks/calls/completed
 *
 * Called by the voice workflow (n8n + telephony provider) when a call ends.
 * Persists the call with transcript/summary and updates CRM + analytics.
 */

const bodySchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  status: z.enum(["COMPLETED", "MISSED", "FAILED", "TRANSFERRED"]),
  fromPhone: z.string().optional(),
  durationSec: z.number().int().min(0).default(0),
  recordingUrl: z.string().url().optional(),
  transcript: z.string().optional(),
  aiSummary: z.string().optional(),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
  outcome: z
    .enum([
      "APPOINTMENT_BOOKED",
      "QUALIFIED",
      "FOLLOW_UP_SCHEDULED",
      "NOT_INTERESTED",
      "NO_ANSWER",
      "TRANSFERRED_TO_HUMAN",
    ])
    .optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { business } = await requireApiKey(req, "webhooks:write");
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const data = parsed.data;

    const contact = data.fromPhone
      ? await prisma.contact.findFirst({
          where: {
            businessId: business.id,
            OR: [{ phone: data.fromPhone }, { whatsapp: data.fromPhone }],
          },
        })
      : null;

    const voiceAgent = await prisma.aiAgent.findUnique({
      where: { businessId_type: { businessId: business.id, type: "VOICE" } },
    });

    const call = await prisma.call.create({
      data: {
        businessId: business.id,
        contactId: contact?.id,
        direction: data.direction,
        status: data.status,
        durationSec: data.durationSec,
        recordingUrl: data.recordingUrl,
        transcript: data.transcript,
        aiSummary: data.aiSummary,
        sentiment: data.sentiment,
        outcome: data.outcome,
        handledByAgentId: voiceAgent?.id,
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      },
    });

    await incrementDailyMetric(
      business.id,
      data.direction === "INBOUND" ? "CALLS_INBOUND" : "CALLS_OUTBOUND",
    );
    if (contact) {
      await recordActivity({
        businessId: business.id,
        type: data.status === "MISSED" ? "CALL_MISSED" : "CALL_COMPLETED",
        title: `${data.direction === "INBOUND" ? "Inbound" : "Outbound"} call ${data.status.toLowerCase()}`,
        description: data.aiSummary,
        contactId: contact.id,
        actorType: "AI_AGENT",
        actorAgentId: voiceAgent?.id,
      });
    }

    return NextResponse.json({ callId: call.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("call webhook failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
