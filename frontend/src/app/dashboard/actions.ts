"use server";

import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { baSession, baUser } from "@/db/auth-schema";
import { internInvites, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { LANGUAGES, MAX_SKILLS, STUDY_YEARS } from "@/lib/intern-options";
import { requireOrganizer } from "@/lib/session";

export type Invite = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  position: string | null;
  college: string | null;
  degree: string | null;
  studyYear: string | null;
  durationMonths: number | null;
  startDate: string | null;
  skills: string[];
  language: string | null;
  status: "invited" | "joined" | "completed" | "revoked";
  invitedAt: string;
};
export type InviteResult = { ok: true; invites: Invite[] } | { ok: false; error: string };

/** Indian 10-digit numbers get +91; anything else must already be international (+…). */
function normalisePhone(raw: string) {
  const v = raw.replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(v)) return `+91${v}`;
  if (/^91[6-9]\d{9}$/.test(v)) return `+${v}`;
  if (/^\+\d{10,15}$/.test(v)) return v;
  return null;
}

const inviteSchema =z.object({
  name: z.string().trim().min(2, "Enter the intern's name.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number.")
    .transform((v, ctx) => {
      const p = normalisePhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 98765 43210." });
      return p ?? "";
    }),
  position: z.string().trim().min(2, "Pick or type a position.").max(40),
  college: z.string().trim().min(2, "Enter the college or institute.").max(120),
  degree: z.string().trim().max(60).optional().transform((v) => v || null),
  studyYear: z.enum(STUDY_YEARS).nullish().transform((v) => v ?? null),
  durationMonths: z.number().int().min(1).max(24).nullish().transform((v) => v ?? null),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid start date.")
    .nullish()
    .transform((v) => v || null),
  skills: z
    .array(z.string().trim().min(1).max(30))
    .max(MAX_SKILLS, `Add at most ${MAX_SKILLS} skills.`)
    .default([]),
  language: z.enum(LANGUAGES).nullish().transform((v) => v ?? null),
});

export type InviteInput = z.input<typeof inviteSchema>;

async function listFor(organizerId: string): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(internInvites)
    .where(eq(internInvites.organizerId, organizerId))
    .orderBy(desc(internInvites.invitedAt));
  return rows
    .filter((r) => r.status !== "revoked")
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      position: r.position,
      college: r.college,
      degree: r.degree,
      studyYear: r.studyYear,
      durationMonths: r.durationMonths,
      startDate: r.startDate,
      skills: r.skills,
      language: r.language,
      status: r.status,
      invitedAt: r.invitedAt.toISOString(),
    }));
}

export async function getInvites(): Promise<Invite[]> {
  const s = await requireOrganizer();
  return listFor(s.userId);
}

export async function inviteIntern(input: InviteInput): Promise<InviteResult> {
  const s = await requireOrganizer();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  const { name, email, phone, ...profile } = parsed.data;

  const existing = (await db.select().from(internInvites).where(eq(internInvites.organizerId, s.userId))).find(
    (r) => r.email.toLowerCase() === email,
  );
  if (existing?.status === "joined") return { ok: false, error: `${email} has already joined.` };
  if (existing?.status === "invited") return { ok: false, error: `${email} is already invited.` };

  // 1. The intern's account. Sign-up is off in Better Auth, so it must exist before a link can be sent.
  const [known] = await db.select().from(baUser).where(eq(baUser.email, email)).limit(1);
  let internUserId = known?.id;
  if (!internUserId) {
    internUserId = crypto.randomUUID();
    await db.insert(baUser).values({ id: internUserId, name, email });
  }

  // 2. The invite row. The email is built from it, so it goes in first.
  const previous = existing ? { status: existing.status, internUserId: existing.internUserId } : null;
  if (existing) {
    await db
      .update(internInvites)
      .set({ name, phone, ...profile, internUserId, clerkInvitationId: null, status: "invited", invitedAt: new Date() })
      .where(eq(internInvites.id, existing.id));
  } else {
    await db.insert(internInvites).values({ organizerId: s.userId, email, name, phone, ...profile, internUserId });
  }

  // 3. Better Auth makes the single-use link and calls our email sender (see lib/auth.ts).
  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/welcome", errorCallbackURL: "/intern-login?error=link" },
      headers: await headers(),
    });
  } catch (e) {
    // Undo, so nobody is left "invited" without an email.
    if (existing && previous) {
      await db.update(internInvites).set({ status: previous.status, internUserId: previous.internUserId }).where(eq(internInvites.id, existing.id));
    } else {
      await db.delete(internInvites).where(and(eq(internInvites.organizerId, s.userId), eq(internInvites.email, email)));
    }
    if (!known) await db.delete(baUser).where(eq(baUser.id, internUserId));
    return { ok: false, error: e instanceof Error && e.message ? e.message : "Could not send the invite. Try again." };
  }
  return { ok: true, invites: await listFor(s.userId) };
}

export async function revokeInvite(id: string): Promise<InviteResult> {
  const s = await requireOrganizer();
  const uuid = z.uuid().safeParse(id);
  if (!uuid.success) return { ok: false, error: "Unknown invite." };

  const [row] = await db.select().from(internInvites).where(eq(internInvites.id, uuid.data)).limit(1);
  if (!row || row.organizerId !== s.userId) return { ok: false, error: "Unknown invite." };
  if (row.status !== "invited") return { ok: false, error: "Only pending invites can be revoked." };

  if (row.clerkInvitationId) {
    try {
      const client = await clerkClient();
      await client.invitations.revokeInvitation(row.clerkInvitationId);
    } catch {
      /* already used or revoked in Clerk — still mark it revoked here */
    }
  }
  await db.update(internInvites).set({ status: "revoked" }).where(eq(internInvites.id, row.id));
  // The unjoined account goes too, which also kills any link already emailed.
  if (row.internUserId) await dropAccountIfUnused(row.internUserId);
  return { ok: true, invites: await listFor(s.userId) };
}

/** Delete an intern login account unless another live invite (e.g. from a second organizer) still uses it. */
async function dropAccountIfUnused(internUserId: string) {
  const still = await db
    .select({ id: internInvites.id })
    .from(internInvites)
    .where(and(eq(internInvites.internUserId, internUserId), ne(internInvites.status, "revoked")))
    .limit(1);
  if (!still.length) await db.delete(baUser).where(eq(baUser.id, internUserId));
}

/** The organizer's own invite row, or an error message. */
async function ownedInvite(organizerId: string, id: string) {
  const uuid = z.uuid().safeParse(id);
  if (!uuid.success) return null;
  const [row] = await db.select().from(internInvites).where(eq(internInvites.id, uuid.data)).limit(1);
  return row && row.organizerId === organizerId ? row : null;
}

/** Never ban or delete an account that is not a plain intern (e.g. an organizer who invited their own email). */
async function isIntern(userId: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.role === "intern";
}

const clerkMessage = (e: unknown, fallback: string) => {
  const m = (e as { errors?: { longMessage?: string; message: string }[] }).errors?.[0];
  return m?.longMessage ?? m?.message ?? fallback;
};

/**
 * Internship finished: the intern leaves the active board and loses access (their sessions are deleted, and
 * `getSession` refuses a completed intern). The record stays for history; `reopenIntern` undoes it.
 */
export async function completeIntern(id: string): Promise<InviteResult> {
  const s = await requireOrganizer();
  const row = await ownedInvite(s.userId, id);
  if (!row) return { ok: false, error: "Unknown intern." };
  if (row.status !== "joined") return { ok: false, error: "Only interns who have joined can be marked completed." };

  // Older interns who signed up through Clerk are banned there instead.
  if (row.userId) {
    if (!(await isIntern(row.userId))) return { ok: false, error: "That account is not an intern." };
    try {
      await (await clerkClient()).users.banUser(row.userId);
    } catch (e) {
      return { ok: false, error: clerkMessage(e, "Could not end their access. Try again.") };
    }
  }
  await db.update(internInvites).set({ status: "completed", completedAt: new Date() }).where(eq(internInvites.id, row.id));
  if (row.internUserId) await db.delete(baSession).where(eq(baSession.userId, row.internUserId));
  return { ok: true, invites: await listFor(s.userId) };
}

/** Undo "completed": puts the intern back on the active board. They sign in again with a fresh link. */
export async function reopenIntern(id: string): Promise<InviteResult> {
  const s = await requireOrganizer();
  const row = await ownedInvite(s.userId, id);
  if (!row) return { ok: false, error: "Unknown intern." };
  if (row.status !== "completed") return { ok: false, error: "This internship is not marked completed." };

  if (row.userId) {
    try {
      await (await clerkClient()).users.unbanUser(row.userId);
    } catch (e) {
      return { ok: false, error: clerkMessage(e, "Could not restore their access. Try again.") };
    }
  }
  await db.update(internInvites).set({ status: "joined", completedAt: null }).where(eq(internInvites.id, row.id));
  return { ok: true, invites: await listFor(s.userId) };
}

/** Permanent removal (left early / added by mistake): deletes their account and the invite row. */
export async function removeIntern(id: string): Promise<InviteResult> {
  const s = await requireOrganizer();
  const row = await ownedInvite(s.userId, id);
  if (!row) return { ok: false, error: "Unknown intern." };
  if (row.status === "invited") return { ok: false, error: "Revoke pending invites instead." };

  if (row.userId) {
    if (!(await isIntern(row.userId))) return { ok: false, error: "That account is not an intern." };
    try {
      await (await clerkClient()).users.deleteUser(row.userId);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status !== 404) return { ok: false, error: clerkMessage(e, "Could not delete their account. Try again.") };
    }
  }
  await db.delete(internInvites).where(eq(internInvites.id, row.id));
  if (row.internUserId) await dropAccountIfUnused(row.internUserId);
  return { ok: true, invites: await listFor(s.userId) };
}

const profileSchema = inviteSchema.omit({ email: true });
export type ProfileInput = z.input<typeof profileSchema>;

/** Edit an intern's details. The email is fixed: it is tied to their invitation and sign-in. */
export async function updateIntern(id: string, input: ProfileInput): Promise<InviteResult> {
  const s = await requireOrganizer();
  const row = await ownedInvite(s.userId, id);
  if (!row || row.status === "revoked") return { ok: false, error: "Unknown intern." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  await db.update(internInvites).set(parsed.data).where(eq(internInvites.id, row.id));
  return { ok: true, invites: await listFor(s.userId) };
}
