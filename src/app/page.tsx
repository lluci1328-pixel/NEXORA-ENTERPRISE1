import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getAccessibleBusinesses } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { IndustryIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/primitives";
import { logoutAction } from "@/lib/actions";
import { APP_NAME, INDUSTRY_LABELS, type BusinessIndustry } from "@/lib/constants";
import { formatCompactCurrency, formatNumber } from "@/lib/utils";
import {
  Sparkles,
  ArrowUpRight,
  Users,
  IndianRupee,
  MessagesSquare,
  Bot,
  LogOut,
  Plus,
  TrendingUp,
} from "lucide-react";

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const businesses = await getAccessibleBusinesses();

  // If a non-owner belongs to exactly one business, send them straight in.
  if (!user.isPlatformOwner && businesses.length === 1) {
    redirect(`/${businesses[0]!.slug}`);
  }

  const snapshots = await Promise.all(
    businesses.map(async (b) => {
      const snap = await getDashboardSnapshot(b.id);
      const contacts = await prisma.contact.count({ where: { businessId: b.id } });
      return { business: b, snap, contacts };
    }),
  );

  const totals = snapshots.reduce(
    (acc, s) => ({
      revenue: acc.revenue + s.snap.revenue30,
      leads: acc.leads + (s.snap.metrics.NEW_LEADS ?? 0),
      conversations: acc.conversations + (s.snap.metrics.CONVERSATIONS ?? 0),
      aiMessages: acc.aiMessages + (s.snap.metrics.AI_MESSAGES ?? 0),
    }),
    { revenue: 0, leads: 0, conversations: 0, aiMessages: 0 },
  );

  const portfolioStats = [
    { label: "Portfolio Revenue (30d)", value: formatCompactCurrency(totals.revenue), icon: IndianRupee, tone: "text-success bg-success-soft" },
    { label: "New Leads (30d)", value: formatNumber(Math.round(totals.leads)), icon: Users, tone: "text-primary bg-primary-softer" },
    { label: "Conversations (30d)", value: formatNumber(Math.round(totals.conversations)), icon: MessagesSquare, tone: "text-purple bg-purple-soft" },
    { label: "AI Messages (30d)", value: formatNumber(Math.round(totals.aiMessages)), icon: Bot, tone: "text-accent bg-[#e0f2fe]" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-text">{APP_NAME}</p>
              <p className="-mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Portfolio Command Center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-semibold text-text">{user.name}</p>
              <p className="text-[11px] text-text-muted">{user.title ?? "Platform Owner"}</p>
            </div>
            <Avatar name={user.name} size={34} tone="gradient" />
            <form action={logoutAction}>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-muted" title="Sign out">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 rise-in">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Welcome back, {user.name.split(" ")[0]}.
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {businesses.length} businesses running on Nexora. Here&apos;s the portfolio at a glance.
            </p>
          </div>
          <button className="btn btn-ghost" disabled title="Provision a new business tenant">
            <Plus size={16} /> Add Business
          </button>
        </div>

        {/* Portfolio totals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {portfolioStats.map((s) => (
            <div key={s.label} className="card card-hover p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.tone}`}>
                <s.icon size={18} />
              </div>
              <p className="mt-4 text-2xl font-bold text-text stat-value">{s.value}</p>
              <p className="mt-1 text-[13px] font-medium text-text-secondary">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Business cards */}
        <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Your Businesses
        </h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {snapshots.map(({ business, snap, contacts }) => (
            <Link
              key={business.id}
              href={`/${business.slug}`}
              className="card card-hover group flex flex-col overflow-hidden"
            >
              <div className="flex items-start justify-between p-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
                    <IndustryIcon industry={business.industry} size={20} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-text">{business.name}</p>
                    <p className="text-xs text-text-muted">
                      {INDUSTRY_LABELS[business.industry as BusinessIndustry]}
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={18} className="text-text-muted transition-colors group-hover:text-primary" />
              </div>

              <div className="grid grid-cols-3 gap-px border-y border-border bg-border">
                <div className="bg-surface px-4 py-3">
                  <p className="text-[11px] text-text-muted">Revenue 30d</p>
                  <p className="text-sm font-bold text-text stat-value">
                    {formatCompactCurrency(snap.revenue30)}
                  </p>
                </div>
                <div className="bg-surface px-4 py-3">
                  <p className="text-[11px] text-text-muted">Contacts</p>
                  <p className="text-sm font-bold text-text stat-value">{formatNumber(contacts)}</p>
                </div>
                <div className="bg-surface px-4 py-3">
                  <p className="text-[11px] text-text-muted">Hot Leads</p>
                  <p className="text-sm font-bold text-text stat-value">{snap.hotLeads}</p>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <span className="h-2 w-2 rounded-full bg-success live-dot" />
                  {snap.activeAgents}/{snap.totalAgents} agents active
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                  <TrendingUp size={13} className="text-success" />
                  {snap.changes.revenue >= 0 ? "+" : ""}
                  {snap.changes.revenue.toFixed(0)}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
