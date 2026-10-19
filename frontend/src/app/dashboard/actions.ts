"use server";

import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { internInvites } from "@/db/schema";
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
  status: "invited" | "joined" | "revoked";
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

const PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://taskora-kappa-seven.vercel.app";
const TRUSTED_HOSTS = new Set([new URL(PRODUCTION_ORIGIN).host, "localhost:3000"]);

/**
 * The invite email links back to this origin, so it must never come straight from request
 * headers. Use the request host only if it is on the allowlist; otherwise the production URL.
 */
async function trustedOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (!TRUSTED_HOSTS.has(host)) return PRODUCTION_ORIGIN;
  return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
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

  const appOrigin = await trustedOrigin();

  let invitationId: string;
  try {
    const client = await clerkClient();
    const inv = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: new URL("/sign-up", appOrigin).toString(),
      notify: true,
      publicMetadata: { role: "intern", invitedBy: s.userId },
    });
    invitationId = inv.id;
  } catch (e) {
    const msg = (e as { errors?: { longMessage?: string; message: string }[] }).errors?.[0];
    return { ok: false, error: msg?.longMessage ?? msg?.message ?? "Could not send the invite. Try again." };
  }

  if (existing) {
    await db
      .update(internInvites)
      .set({ name, phone, ...profile, clerkInvitationId: invitationId, status: "invited", invitedAt: new Date() })
      .where(eq(internInvites.id, existing.id));
  } else {
    await db
      .insert(internInvites)
      .values({ organizerId: s.userId, email, name, phone, ...profile, clerkInvitationId: invitationId });
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
  return { ok: true, invites: await listFor(s.userId) };
}
