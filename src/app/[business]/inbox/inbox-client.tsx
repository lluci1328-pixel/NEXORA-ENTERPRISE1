"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import {
  Send,
  Hand,
  Bot,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  MessageCircle,
  Camera,
  Users as UsersIcon,
  Globe,
  Image as ImageIcon,
  Mic,
  FileText,
} from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { ConversationStatusBadge } from "@/components/ui/badges";
import { cn, timeAgo } from "@/lib/utils";
import {
  handBackToAiAction,
  markConversationResolvedAction,
  sendHumanMessageAction,
  takeoverConversationAction,
} from "@/lib/actions";

const CHANNEL_ICON: Record<string, typeof Phone> = {
  WHATSAPP: MessageCircle,
  WEBSITE_CHAT: Globe,
  INSTAGRAM: Camera,
  FACEBOOK: UsersIcon,
  PHONE: Phone,
  EMAIL: Mail,
  TELEGRAM: Send,
};

const CONTENT_ICON: Record<string, typeof ImageIcon> = {
  IMAGE: ImageIcon,
  VOICE_NOTE: Mic,
  AUDIO: Mic,
  DOCUMENT: FileText,
};

interface ConvSummary {
  id: string;
  name: string;
  channelType: string;
  status: string;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  sentiment: string | null;
}

interface Message {
  id: string;
  senderType: string;
  body: string;
  agentName: string | null;
  contentType: string;
  createdAt: string;
}

interface ActiveConv {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channelType: string;
  status: string;
  aiSummary: string | null;
  sentiment: string | null;
  agentName: string | null;
  humanName: string | null;
  leadScore: number | null;
  leadStatus: string | null;
  messages: Message[];
}

export function InboxClient({
  slug,
  conversations,
  active,
}: {
  slug: string;
  conversations: ConvSummary[];
  active: ActiveConv | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("ALL");
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [active?.id, active?.messages.length]);

  const filtered = conversations.filter((c) => {
    if (filter === "ALL") return true;
    if (filter === "AI") return c.status === "AI_HANDLING";
    if (filter === "HUMAN") return c.status === "HUMAN_TAKEOVER";
    if (filter === "RESOLVED") return c.status === "RESOLVED";
    return true;
  });

  const select = (id: string) => router.push(`/${slug}/inbox?c=${id}`);

  const doTakeover = () =>
    active && startTransition(async () => {
      await takeoverConversationAction(slug, active.id);
      router.refresh();
    });
  const doHandback = () =>
    active && startTransition(async () => {
      await handBackToAiAction(slug, active.id);
      router.refresh();
    });
  const doResolve = () =>
    active && startTransition(async () => {
      await markConversationResolvedAction(slug, active.id);
      router.refresh();
    });
  const doSend = () => {
    if (!active || !draft.trim()) return;
    const body = draft;
    setDraft("");
    startTransition(async () => {
      await sendHumanMessageAction(slug, active.id, body);
      router.refresh();
    });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversation list */}
      <div className="flex w-80 shrink-0 flex-col card overflow-hidden">
        <div className="border-b border-border p-3">
          <div className="flex gap-1">
            {[
              ["ALL", "All"],
              ["AI", "AI"],
              ["HUMAN", "Human"],
              ["RESOLVED", "Done"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                  filter === key ? "bg-primary-soft text-primary-hover" : "text-text-muted hover:bg-surface-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim">
          {filtered.map((c) => {
            const Icon = CHANNEL_ICON[c.channelType] ?? MessageCircle;
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-surface-muted",
                  active?.id === c.id && "bg-primary-softer",
                )}
              >
                <div className="relative">
                  <Avatar name={c.name} size={40} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-inset text-text-secondary">
                    <Icon size={11} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-text">{c.name}</p>
                    <span className="shrink-0 text-[10px] text-text-muted">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-muted">{c.preview}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ConversationStatusBadge status={c.status} />
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation thread */}
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col card overflow-hidden">
          {/* Thread header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={active.name} size={40} tone="gradient" />
              <div>
                <p className="text-sm font-semibold text-text">{active.name}</p>
                <p className="text-xs text-text-muted">
                  {active.phone ?? active.email ?? active.channelType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {active.status === "HUMAN_TAKEOVER" ? (
                <button onClick={doHandback} disabled={pending} className="btn btn-ghost py-1.5 text-xs">
                  <Bot size={14} /> Hand back to AI
                </button>
              ) : (
                <button onClick={doTakeover} disabled={pending} className="btn btn-soft py-1.5 text-xs">
                  <Hand size={14} /> Take over
                </button>
              )}
              {active.status !== "RESOLVED" && (
                <button onClick={doResolve} disabled={pending} className="btn btn-ghost py-1.5 text-xs">
                  <CheckCircle2 size={14} /> Resolve
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-slim bg-surface-muted/40 px-5 py-4">
            {active.messages.map((m) => {
              const isCustomer = m.senderType === "CUSTOMER";
              const CIcon = CONTENT_ICON[m.contentType];
              return (
                <div key={m.id} className={cn("flex", isCustomer ? "justify-start" : "justify-end")}>
                  <div className={cn("max-w-[72%]")}>
                    {!isCustomer && (
                      <p className="mb-1 flex items-center justify-end gap-1 text-[10px] font-medium text-text-muted">
                        {m.senderType === "AI_AGENT" ? (
                          <>
                            <Sparkles size={10} className="text-primary" />
                            {m.agentName ?? "AI Agent"}
                          </>
                        ) : (
                          "You"
                        )}
                      </p>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                        isCustomer
                          ? "rounded-tl-sm bg-surface text-text"
                          : m.senderType === "AI_AGENT"
                            ? "rounded-tr-sm bg-primary text-white"
                            : "rounded-tr-sm bg-purple text-white",
                      )}
                    >
                      {CIcon && (
                        <span className="mb-1 flex items-center gap-1.5 text-xs opacity-80">
                          <CIcon size={13} /> {m.contentType.replace("_", " ").toLowerCase()}
                        </span>
                      )}
                      {m.body}
                    </div>
                    <p className={cn("mt-1 text-[10px] text-text-muted", isCustomer ? "text-left" : "text-right")}>
                      {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            {active.status === "AI_HANDLING" && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary-softer px-3 py-2 text-xs text-primary-hover">
                <Sparkles size={13} />
                AI is handling this conversation. Take over to reply as a human.
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    doSend();
                  }
                }}
                rows={1}
                placeholder="Type a message… (Enter to send)"
                className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
              />
              <button onClick={doSend} disabled={pending || !draft.trim()} className="btn btn-primary h-[42px] px-4 disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center card">
          <p className="text-sm text-text-muted">Select a conversation to view.</p>
        </div>
      )}

      {/* Context panel */}
      {active && (
        <div className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={active.name} size={44} tone="gradient" />
              <div>
                <p className="text-sm font-semibold text-text">{active.name}</p>
                <p className="text-xs text-text-muted">{active.channelType.replace("_", " ")}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {active.phone && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Phone size={13} className="text-text-muted" /> {active.phone}
                </p>
              )}
              {active.email && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Mail size={13} className="text-text-muted" /> {active.email}
                </p>
              )}
            </div>
          </div>

          {active.leadScore !== null && (
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Lead</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-text-secondary">AI Score</span>
                <Badge tone={active.leadScore >= 85 ? "success" : active.leadScore >= 60 ? "primary" : "warning"}>
                  {active.leadScore}/100
                </Badge>
              </div>
              {active.leadStatus && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Status</span>
                  <Badge tone="neutral">{active.leadStatus}</Badge>
                </div>
              )}
            </div>
          )}

          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Sparkles size={12} className="text-primary" /> AI Summary
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {active.aiSummary ?? "Summary will appear once the AI has processed this conversation."}
            </p>
            {active.sentiment && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-text-secondary">Sentiment</span>
                <Badge tone={active.sentiment === "POSITIVE" ? "success" : active.sentiment === "NEGATIVE" ? "danger" : "neutral"}>
                  {active.sentiment}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
