"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { standups, taskEvents, tasks } from "@/db/schema";
import { currentInternInvite } from "@/lib/session";
import { UPDATE_STATUSES, type MessageView, type TaskView } from "@/lib/task-types";
import { listMessagesForInvite, toView } from "@/lib/tasks";

const updateSchema = z.object({
  taskId: z.uuid(),
  text: z.string().trim().min(2, "Write a few words about the task.").max(400, "Keep it under 400 characters."),
  status: z.enum(UPDATE_STATUSES),
});

/**
 * An intern tells their organizer how a task is going ("started", "blocked: need the API key").
 * Saves the note, moves the task to the chosen status and writes the task history. The task must belong
 * to the signed-in intern's own invite: this is the server-side "interns change only their own tasks" check.
 */
export async function postTaskUpdate(input: { taskId: string; text: string; status: string }): Promise<{ ok: true; task: TaskView } | { ok: false; error: string }> {
  const found = await currentInternInvite();
  if (!found) return { ok: false, error: "Please sign in again." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your update." };
  const { taskId, text, status } = parsed.data;

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.inviteId, found.invite.id))).limit(1);
  if (!task) return { ok: false, error: "That task is not yours." };

  const [row] = await db
    .update(tasks)
    .set({ status, progress: status === "done" ? 100 : task.progress, updatedAt: new Date() })
    .where(eq(tasks.id, task.id))
    .returning();
  await db.insert(standups).values({ taskId: task.id, inviteId: task.inviteId, organizerId: task.organizerId, body: text, status });
  await db.insert(taskEvents).values({
    taskId: task.id,
    actorId: found.ba.user.id,
    kind: task.status === status ? "note" : "status_changed",
    data: { from: task.status, to: status, text },
  });
  return { ok: true, task: { ...toView(row), note: text } };
}

/** The signed-in intern's own messages from their organizer (polled by the intern page). */
export async function getMyMessages(): Promise<MessageView[]> {
  const found = await currentInternInvite();
  return found ? listMessagesForInvite(found.invite.id) : [];
}
