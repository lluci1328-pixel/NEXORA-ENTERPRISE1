"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, LogOut, Check } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { timeAgo, cn, titleCase } from "@/lib/utils";
import { logoutAction, markAllNotificationsReadAction } from "@/lib/actions";

const SEGMENT_TITLES: Record<string, string> = {
  inbox: "Inbox",
  agents: "AI Agents",
  workflows: "Workflows",
  calls: "Calls",
  crm: "Pulse CRM",
  leads: "Leads",
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  tasks: "Tasks",
  appointments: "Appointments",
  knowledge: "Knowledge Base",
  analytics: "Analytics",
  team: "Team",
  settings: "Settings",
};

function derivePageTitle(pathname: string, slug: string): string {
  const rest = pathname.replace(`/${slug}`, "").split("/").filter(Boolean);
  if (rest.length === 0) return "Dashboard";
  const key = rest[rest.length - 1]!;
  return SEGMENT_TITLES[key] ?? titleCase(key);
}

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  readAt: Date | null;
  createdAt: Date;
}

export function Topbar({
  slug,
  userName,
  userTitle,
  notifications,
  unreadCount,
}: {
  slug: string;
  userName: string;
  userTitle: string;
  notifications: Notif[];
  unreadCount: number;
}) {
  const [openNotif, setOpenNotif] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const pathname = usePathname();
  const pageTitle = derivePageTitle(pathname, slug);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-canvas/80 px-6 backdrop-blur-md">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Search leads, contacts, deals…"
            className="input w-72 py-2 pl-9 text-[13px]"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenNotif((v) => !v);
              setOpenUser(false);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {openNotif && (
            <div className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-text">Notifications</p>
                {unreadCount > 0 && (
                  <form action={markAllNotificationsReadAction.bind(null, slug)}>
                    <button className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover">
                      <Check size={13} /> Mark all read
                    </button>
                  </form>
                )}
              </div>
              <div className="max-h-96 overflow-auto scrollbar-slim">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-text-muted">You&apos;re all caught up.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 border-b border-border px-4 py-3 last:border-0",
                        !n.readAt && "bg-primary-softer/50",
                      )}
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background:
                            n.priority === "CRITICAL" || n.priority === "HIGH"
                              ? "var(--danger)"
                              : "var(--primary)",
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p>
                        <p className="mt-1 text-[11px] text-text-muted">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenUser((v) => !v);
              setOpenNotif(false);
            }}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-surface py-1.5 pl-1.5 pr-3 transition-colors hover:bg-surface-muted"
          >
            <Avatar name={userName} size={30} tone="gradient" />
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-semibold leading-tight text-text">{userName}</p>
              <p className="text-[11px] leading-tight text-text-muted">{userTitle}</p>
            </div>
          </button>
          {openUser && (
            <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg">
              <div className="px-3 py-2">
                <p className="text-[13px] font-semibold text-text">{userName}</p>
                <p className="text-xs text-text-muted">{userTitle}</p>
              </div>
              <div className="my-1 border-t border-border" />
              <form action={logoutAction}>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger-soft">
                  <LogOut size={15} /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
