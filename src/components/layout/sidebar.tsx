"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Contact as ContactIcon,
  KanbanSquare,
  CheckSquare,
  CalendarDays,
  MessagesSquare,
  Bot,
  Workflow,
  BookOpen,
  PhoneCall,
  BarChart3,
  UsersRound,
  Settings,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IndustryIcon } from "@/components/ui/icons";
import { APP_NAME, CRM_NAME } from "@/lib/constants";

interface NavBusiness {
  slug: string;
  name: string;
  industry: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export function Sidebar({
  slug,
  businessName,
  industry,
  businesses,
  role,
}: {
  slug: string;
  businessName: string;
  industry: string;
  businesses: NavBusiness[];
  role: string;
}) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const base = `/${slug}`;
  const main: NavItem[] = [
    { href: base, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/inbox`, label: "Inbox", icon: MessagesSquare },
    { href: `${base}/agents`, label: "AI Agents", icon: Bot },
    { href: `${base}/workflows`, label: "Workflows", icon: Workflow },
    { href: `${base}/calls`, label: "Calls", icon: PhoneCall },
  ];
  const crm: NavItem[] = [
    { href: `${base}/crm/leads`, label: "Leads", icon: Users },
    { href: `${base}/crm/contacts`, label: "Contacts", icon: ContactIcon },
    { href: `${base}/crm/deals`, label: "Deals", icon: KanbanSquare },
    { href: `${base}/crm/tasks`, label: "Tasks", icon: CheckSquare },
    { href: `${base}/crm/appointments`, label: "Appointments", icon: CalendarDays },
  ];
  const insight: NavItem[] = [
    { href: `${base}/knowledge`, label: "Knowledge Base", icon: BookOpen },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
    { href: `${base}/team`, label: "Team", icon: UsersRound },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary-soft text-primary-hover"
            : "text-text-secondary hover:bg-surface-muted hover:text-text",
        )}
      >
        <Icon size={17} className={active ? "text-primary" : "text-text-muted group-hover:text-text-secondary"} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-[15px] font-bold tracking-tight text-text">{APP_NAME}</p>
          <p className="-mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            AI Automation
          </p>
        </div>
      </div>

      {/* Business switcher */}
      <div className="relative px-3">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-left transition-colors hover:border-border-strong"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-softer text-primary">
            <IndustryIcon industry={industry} size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">{businessName}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{role}</p>
          </div>
          <ChevronDown size={15} className={cn("text-text-muted transition-transform", switcherOpen && "rotate-180")} />
        </button>
        {switcherOpen && (
          <div className="absolute left-3 right-3 z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg scrollbar-slim">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted"
              onClick={() => setSwitcherOpen(false)}
            >
              <LayoutDashboard size={14} /> Portfolio Overview
            </Link>
            <div className="my-1 border-t border-border" />
            {businesses.map((b) => (
              <Link
                key={b.slug}
                href={`/${b.slug}`}
                onClick={() => setSwitcherOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  b.slug === slug ? "bg-primary-soft text-primary-hover" : "text-text-secondary hover:bg-surface-muted",
                )}
              >
                <IndustryIcon industry={b.industry} size={15} className="text-text-muted" />
                <span className="truncate">{b.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-slim">
        <div className="space-y-0.5">
          {main.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {CRM_NAME}
          </p>
          <div className="space-y-0.5">
            {crm.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Intelligence
          </p>
          <div className="space-y-0.5">
            {insight.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
