"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { internInvites, taskEvents, tasks } from "@/db/schema";
import { BASE_URL } from "@/lib/base-url";
import { sendTaskEmail } from "@/lib/email";
import { requireOrganizer } from "@/lib/session";
import { fmtDue, PAST_DATE_ERROR, todayIST, type StandupView, type TaskResult, type TaskView } from "@/lib/task-types";
import { listStandups, listTasksForOrganizer, toView } from "@/lib/tasks";

/** An intern on this organizer's batch who can still receive work (invited or joined). */
async function ownInvite(organizerId: string, inviteId: string) {
  const [invite] = await db
    .select()
    .from(internInvites)
    .where(and(eq(internInvites.id, inviteId), eq(internInvites.organizerId, organizerId), inArray(internInvites.status, ["invited", "joined"])))
    .limit(1);
  return invite ?? null;
}

async function ownTask(organizerId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.organizerId, organizerId))).limit(1);
  return task ?? null;
}

export async function getTasks(): Promise<TaskView[]> {
  const s = await requireOrganizer();
  return listTasksForOrganizer(s.userId);
}

const assignSchema = z.object({
  inviteId: z.uuid(),
  title: z.string().trim().min(2, "Say what the task is.").max(120, "Keep the task under 120 characters."),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Say the deadline as a date.")
    .refine((d) => d >= todayIST(), PAST_DATE_ERROR),
});

export async function assignTask(input: { inviteId: string; title: string; due: string }): Promise<TaskResult> {
  const s = await requireOrganizer();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the task details." };
  const { inviteId, title, due } = parsed.data;
  if (!(await ownInvite(s.userId, inviteId))) return { ok: false, error: "That intern is not on your batch." };

  const [row] = await db.insert(tasks).values({ organizerId: s.userId, inviteId, title, dueDate: due }).returning();
  await db.insert(taskEvents).values({ taskId: row.id, actorId: s.userId, kind: "created", data: { inviteId, title, due } });
  return { ok: true, task: toView(row) };
}

/** Move a task to another intern on the batch. */
export async function reassignTask(taskId: string, toInviteId: string): Promise<TaskResult> {
  const s = await requireOrganizer();
  const task = z.uuid().safeParse(taskId).success ? await ownTask(s.userId, taskId) : null;
  if (!task) return { ok: false, error: "I couldn't find that task." };
  if (!z.uuid().safeParse(toInviteId).success || !(await ownInvite(s.userId, toInviteId))) return { ok: false, error: "That intern is not on your batch." };

  const [row] = await db.update(tasks).set({ inviteId: toInviteId, emailSentAt: null, updatedAt: new Date() }).where(eq(tasks.id, task.id)).returning();
  await db.insert(taskEvents).values({ taskId: task.id, actorId: s.userId, kind: "reassigned", data: { from: task.inviteId, to: toInviteId } });
  return { ok: true, task: toView(row) };
}

/** Email the intern about a task. Only joined interns are emailed: the link needs their account. */
export async function emailTask(taskId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await requireOrganizer();
  const task = z.uuid().safeParse(taskId).success ? await ownTask(s.userId, taskId) : null;
  if (!task) return { ok: false, error: "I couldn't find that task." };
  const invite = await ownInvite(s.userId, task.inviteId);
  if (!invite) return { ok: false, error: "That intern is not on your batch." };
  const name = invite.name ?? invite.email;
  if (invite.status !== "joined") return { ok: false, error: `${name.split(" ")[0]} hasn't joined yet, so I can't email the task. It will show on their page once they sign in.` };

  const error = await sendTaskEmail(invite.email, { name, title: task.title, due: fmtDue(task.dueDate), url: `${BASE_URL}/me` });
  if (error) return { ok: false, error };
  await db.update(tasks).set({ emailSentAt: new Date() }).where(eq(tasks.id, task.id));
  await db.insert(taskEvents).values({ taskId: task.id, actorId: s.userId, kind: "emailed", data: { to: invite.email } });
  return { ok: true };
}

/** The organizer's newest intern updates for the Standups feed. */
export async function getStandups(): Promise<StandupView[]> {
  const s = await requireOrganizer();
  return listStandups(s.userId);
}
