import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Avatar, Badge } from "@/components/ui/primitives";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { UserPlus, ShieldCheck, Mail } from "lucide-react";

const ROLE_TONE: Record<string, "primary" | "purple" | "success" | "warning" | "neutral"> = {
  OWNER: "warning",
  ADMIN: "purple",
  MANAGER: "primary",
  AGENT: "success",
  SUPPORT: "neutral",
};

const ROLE_DESCRIPTION: Record<string, string> = {
  OWNER: "Full access to every business, billing and platform settings.",
  ADMIN: "Manages this business — team, agents, integrations and data.",
  MANAGER: "Oversees sales, pipelines and team performance.",
  AGENT: "Works leads, deals and conversations assigned to them.",
  SUPPORT: "Handles customer support conversations and takeovers.",
};

export default async function TeamPage({ params }: { params: Promise<{ business: string }> }) {
  const { business, role: viewerRole } = await resolvePageContext((await params).business);

  const memberships = await prisma.membership.findMany({
    where: { businessId: business.id },
    include: { user: true },
  });

  const ordered = memberships.sort(
    (a, b) => (ROLE_TONE[b.role] ? 1 : 0) - (ROLE_TONE[a.role] ? 1 : 0),
  );

  const canManage = viewerRole === "OWNER" || viewerRole === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeading title="Team" description={`${memberships.length} members with role-based access`}>
        <button className="btn btn-primary" disabled={!canManage} title={canManage ? "Invite a team member" : "Only owners and admins can invite"}>
          <UserPlus size={16} /> Invite Member
        </button>
      </PageHeading>

      {/* Roles legend */}
      <Card className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <ShieldCheck size={13} /> Role-Based Access Control
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["OWNER", "ADMIN", "MANAGER", "AGENT", "SUPPORT"] as Role[]).map((r) => (
            <div key={r} className="rounded-lg border border-border bg-surface-muted p-3">
              <Badge tone={ROLE_TONE[r]}>{ROLE_LABELS[r]}</Badge>
              <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">{ROLE_DESCRIPTION[r]}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordered.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.user.name} size={36} tone="gradient" />
                      <div>
                        <p className="text-[13px] font-semibold text-text">{m.user.name}</p>
                        <p className="flex items-center gap-1 text-xs text-text-muted">
                          <Mail size={10} /> {m.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge tone={ROLE_TONE[m.role] ?? "neutral"}>{ROLE_LABELS[m.role as Role]}</Badge></td>
                  <td className="px-5 py-3 text-[13px] text-text-secondary">{m.user.title ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={m.user.status === "ACTIVE" ? "success" : "neutral"} dot={m.user.status === "ACTIVE"}>
                      {m.user.status === "ACTIVE" ? "Active" : "Invited"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-text-muted">
                    {m.user.lastLoginAt ? timeAgo(m.user.lastLoginAt) : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
