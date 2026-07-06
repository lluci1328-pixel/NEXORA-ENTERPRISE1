import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/provider";

export async function GET() {
  try {
    const businesses = await prisma.business.count();
    return NextResponse.json({
      status: "ok",
      service: "nexora",
      businesses,
      aiProviderConfigured: isAiConfigured(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "degraded", service: "nexora" }, { status: 503 });
  }
}
