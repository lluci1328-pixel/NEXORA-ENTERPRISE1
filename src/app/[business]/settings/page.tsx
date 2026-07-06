import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/provider";
import { PageHeading, Card, CardHeader, Badge } from "@/components/ui/primitives";
import { StatusDot } from "@/components/ui/badges";
import { INTEGRATION_LABELS, INDUSTRY_LABELS, CHANNEL_LABELS, type IntegrationProvider, type BusinessIndustry, type ChannelType } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { Building2, Plug, KeyRound, Radio } from "lucide-react";

export default async function SettingsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business, "ADMIN");

  const [integrations, channels, apiKeys] = await Promise.all([
    prisma.integration.findMany({ where: { businessId: business.id }, orderBy: { provider: "asc" } }),
    prisma.channel.findMany({ where: { businessId: business.id } }),
    prisma.apiKey.findMany({ where: { businessId: business.id, revokedAt: null } }),
  ]);

  const aiReady = isAiConfigured();

  return (
    <div className="space-y-6">
      <PageHeading title="Settings" description="Business profile, channels, integrations and API access" />

      {/* Business profile */}
      <Card>
        <CardHeader title="Business Profile" icon={<Building2 size={16} />} />
        <div className="grid gap-4 p-5 pt-3 sm:grid-cols-2">
          <Field label="Business Name" value={business.name} />
          <Field label="Industry" value={INDUSTRY_LABELS[business.industry as BusinessIndustry]} />
          <Field label="Timezone" value={business.timezone} />
          <Field label="Currency" value={business.currency} />
          <Field label="Workspace URL" value={`nexora.app/${business.slug}`} mono />
          <Field label="Status" value={business.status} />
        </div>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader title="Channels" subtitle="Where your customers reach you" icon={<Radio size={16} />} />
        <div className="grid gap-3 p-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-text">{CHANNEL_LABELS[ch.type as ChannelType]}</p>
                <p className="text-xs text-text-muted">{ch.name}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <StatusDot connected={ch.status === "CONNECTED"} />
                {ch.status === "CONNECTED" ? "Connected" : "Off"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* AI provider highlight */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
              <KeyRound size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Anthropic Claude (AI Engine)</p>
              <p className="text-xs text-text-muted">
                Powers all agents. Set <span className="font-mono">ANTHROPIC_API_KEY</span> in your environment.
              </p>
            </div>
          </div>
          <Badge tone={aiReady ? "success" : "warning"} dot>
            {aiReady ? "Connected" : "Awaiting API Key"}
          </Badge>
        </div>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader title="Integrations" subtitle="Connect the tools your business already uses" icon={<Plug size={16} />} />
        <div className="grid gap-3 p-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((int) => (
            <div key={int.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-text">
                  {INTEGRATION_LABELS[int.provider as IntegrationProvider] ?? int.name}
                </p>
                <p className="text-xs text-text-muted">
                  {int.lastSyncAt ? `Synced ${timeAgo(int.lastSyncAt)}` : "Not connected"}
                </p>
              </div>
              <Badge tone={int.status === "CONNECTED" ? "success" : "neutral"}>
                {int.status === "CONNECTED" ? "Connected" : "Connect"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* API keys */}
      <Card>
        <CardHeader title="API Keys" subtitle="Used by n8n and external systems to call Nexora" icon={<KeyRound size={16} />} />
        <div className="divide-y divide-border">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-[13px] font-semibold text-text">{k.name}</p>
                <p className="font-mono text-xs text-text-muted">{k.prefix}••••••••••••</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary">
                  {k.lastUsedAt ? `Last used ${timeAgo(k.lastUsedAt)}` : "Never used"}
                </p>
                <Badge tone="success">Active</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-sm font-medium text-text ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
