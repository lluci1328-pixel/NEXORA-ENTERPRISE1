import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { InboxClient } from "./inbox-client";

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ business: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { business } = await resolvePageContext((await params).business);
  const { c: selectedId } = await searchParams;

  const conversations = await prisma.conversation.findMany({
    where: { businessId: business.id },
    include: {
      contact: true,
      aiAgent: true,
      humanAssignee: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  const activeId = selectedId ?? conversations[0]?.id;
  const active = activeId
    ? await prisma.conversation.findFirst({
        where: { id: activeId, businessId: business.id },
        include: {
          contact: true,
          aiAgent: true,
          humanAssignee: true,
          messages: { orderBy: { createdAt: "asc" }, include: { senderAgent: true } },
        },
      })
    : null;

  const leadForContact = active
    ? await prisma.lead.findFirst({
        where: { businessId: business.id, contactId: active.contactId },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <InboxClient
      slug={business.slug}
      conversations={conversations.map((c) => ({
        id: c.id,
        name: `${c.contact.firstName} ${c.contact.lastName ?? ""}`.trim(),
        channelType: c.channelType,
        status: c.status,
        preview: c.messages[0]?.body ?? "",
        lastMessageAt: c.lastMessageAt.toISOString(),
        unreadCount: c.unreadCount,
        sentiment: c.sentiment,
      }))}
      active={
        active
          ? {
              id: active.id,
              name: `${active.contact.firstName} ${active.contact.lastName ?? ""}`.trim(),
              phone: active.contact.phone,
              email: active.contact.email,
              channelType: active.channelType,
              status: active.status,
              aiSummary: active.aiSummary,
              sentiment: active.sentiment,
              agentName: active.aiAgent?.name ?? null,
              humanName: active.humanAssignee?.name ?? null,
              leadScore: leadForContact?.score ?? null,
              leadStatus: leadForContact?.status ?? null,
              messages: active.messages.map((m) => ({
                id: m.id,
                senderType: m.senderType,
                body: m.body,
                agentName: m.senderAgent?.name ?? null,
                contentType: m.contentType,
                createdAt: m.createdAt.toISOString(),
              })),
            }
          : null
      }
    />
  );
}
