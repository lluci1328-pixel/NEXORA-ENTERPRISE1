import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Avatar } from "@/components/ui/primitives";
import { PriorityBadge } from "@/components/ui/badges";
import { TaskCheckbox } from "./task-checkbox";
import { Bot } from "lucide-react";

export default async function TasksPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const tasks = await prisma.task.findMany({
    where: { businessId: business.id },
    include: { assignedTo: true, contact: true },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 100,
  });

  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const done = tasks.filter((t) => t.status === "COMPLETED");

  const Row = ({ task }: { task: (typeof tasks)[number] }) => {
    const overdue = task.dueAt && task.dueAt < new Date() && task.status !== "COMPLETED";
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <TaskCheckbox slug={business.slug} taskId={task.id} completed={task.status === "COMPLETED"} />
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-medium ${task.status === "COMPLETED" ? "text-text-muted line-through" : "text-text"}`}>
            {task.title}
          </p>
          <p className="text-xs text-text-muted">
            {task.contact ? `${task.contact.firstName} · ` : ""}
            {task.dueAt
              ? task.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "No due date"}
            {overdue && <span className="ml-1 font-semibold text-danger">Overdue</span>}
          </p>
        </div>
        {task.createdByType === "AI_AGENT" && (
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <Bot size={12} /> AI
          </span>
        )}
        <PriorityBadge priority={task.priority} />
        {task.assignedTo && <Avatar name={task.assignedTo.name} size={26} tone="neutral" />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeading title="Tasks" description={`${open.length} open · ${done.length} completed`} />

      <Card>
        <p className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Open Tasks
        </p>
        <div className="divide-y divide-border">
          {open.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-muted">No open tasks. Great work!</p>
          ) : (
            open.map((t) => <Row key={t.id} task={t} />)
          )}
        </div>
      </Card>

      {done.length > 0 && (
        <Card>
          <p className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Completed
          </p>
          <div className="divide-y divide-border opacity-70">
            {done.slice(0, 20).map((t) => <Row key={t.id} task={t} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
