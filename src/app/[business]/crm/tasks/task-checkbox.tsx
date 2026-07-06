"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleTaskAction } from "@/lib/actions";

export function TaskCheckbox({
  slug,
  taskId,
  completed,
}: {
  slug: string;
  taskId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleTaskAction(slug, taskId);
          router.refresh();
        })
      }
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        completed ? "border-success bg-success text-white" : "border-border-strong bg-surface hover:border-primary",
      )}
    >
      {completed && <Check size={13} />}
    </button>
  );
}
