import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiAuthError, requireApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/webhooks/workflows/runs
 *
 * n8n reports every workflow execution here (success or failure) so the
 * Workflows dashboard shows real run history, durations and error rates.
 * Identify the workflow either by Nexora workflowId or by n8nWorkflowId.
 */

const bodySchema = z.object({
  workflowId: z.string().optional(),
  n8nWorkflowId: z.string().optional(),
  status: z.enum(["RUNNING", "SUCCESS", "FAILED"]),
  triggerSource: z.string().optional(),
  stepsCompleted: z.number().int().min(0).default(0),
  totalSteps: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
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

    const workflow = await prisma.workflow.findFirst({
      where: {
        businessId: business.id,
        ...(data.workflowId
          ? { id: data.workflowId }
          : { n8nWorkflowId: data.n8nWorkflowId ?? "__none__" }),
      },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found for this business" }, { status: 404 });
    }

    const run = await prisma.workflowRun.create({
      data: {
        businessId: business.id,
        workflowId: workflow.id,
        status: data.status,
        triggerSource: data.triggerSource,
        stepsCompleted: data.stepsCompleted,
        totalSteps: data.totalSteps,
        durationMs: data.durationMs,
        error: data.error,
        metadataJson: JSON.stringify(data.metadata ?? {}),
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
      },
    });

    if (data.status === "FAILED") {
      await prisma.notification.create({
        data: {
          businessId: business.id,
          type: "WORKFLOW_FAILED",
          title: `Workflow failed: ${workflow.name}`,
          body: data.error ?? "Execution failed — check the n8n execution log.",
          priority: "HIGH",
        },
      });
    }

    return NextResponse.json({ runId: run.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("workflow run webhook failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
