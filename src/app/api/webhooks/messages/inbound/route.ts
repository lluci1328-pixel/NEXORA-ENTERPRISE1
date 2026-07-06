import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiAuthError, requireApiKey } from "@/lib/api-auth";
import { processInboundMessage } from "@/lib/ai/orchestrator";
import { CHANNEL_TYPES } from "@/lib/constants";

/**
 * POST /api/webhooks/messages/inbound
 *
 * Called by n8n (or any channel provider) for every inbound customer message.
 * Runs the full multi-agent pipeline and returns the AI reply so the workflow
 * can deliver it back on the originating channel.
 *
 * Auth: Bearer API key (Settings → API Keys), scope "webhooks:write" or "*".
 */

const bodySchema = z.object({
  channelType: z.enum(CHANNEL_TYPES),
  fromPhone: z.string().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
  contentType: z
    .enum(["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "VOICE_NOTE", "LOCATION"])
    .default("TEXT"),
  body: z.string().min(1),
  mediaUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { business } = await requireApiKey(req, "webhooks:write");
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await processInboundMessage({
      businessId: business.id,
      ...parsed.data,
    });

    return NextResponse.json(result, {
      status: result.status === "AI_NOT_CONFIGURED" ? 202 : 200,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("inbound message webhook failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
