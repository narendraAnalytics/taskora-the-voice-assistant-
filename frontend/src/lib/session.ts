import "server-only";
import { headers } from "next/headers";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { internInvites, users } from "@/db/schema";
import { upsertUser } from "@/db/users";
import { auth as internAuth } from "@/lib/auth";

export type Session = {
  userId: string;
  role: "organizer" | "intern" | "admin";
  name: string;
};

/**
 * The signed-in user's role comes from Neon (never from the client). A user who has not been
 * synced yet is created here as an intern, so the first page load after sign-up still works.
 */
export async function getSession(): Promise<Session | null> {
  const { userId } = await clerkAuth();
  if (!userId) return getInternSession();

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (row) {
    return { userId, role: row.role, name: row.username ?? row.firstName ?? "there" };
  }

  const user = await currentUser();
  if (!user) return null;
  await upsertUser({
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  });
  return { userId, role: "intern", name: user.username ?? user.firstName ?? "there" };
}

/**
 * Interns sign in with Better Auth (magic link). Access needs a live invite: a completed or revoked intern
 * has none, so a leftover cookie gets nothing. The first valid session after the invite email marks the
 * invite as joined.
 */
export async function getInternSession(): Promise<Session | null> {
  const found = await currentInternInvite();
  if (!found) return null;
  const { ba, invite } = found;
  if (invite.status === "invited") {
    await db.update(internInvites).set({ status: "joined", joinedAt: new Date() }).where(eq(internInvites.id, invite.id));
  }
  return { userId: ba.user.id, role: "intern", name: invite.name ?? ba.user.name };
}

/** The signed-in intern's Better Auth session plus their live invite (null if signed out or access ended). */
export async function currentInternInvite() {
  const ba = await internAuth.api.getSession({ headers: await headers() });
  if (!ba) return null;

  const [invite] = await db
    .select()
    .from(internInvites)
    .where(and(sql`lower(${internInvites.email}) = lower(${ba.user.email})`, ne(internInvites.status, "revoked")))
    .orderBy(desc(internInvites.invitedAt))
    .limit(1);
  if (!invite || invite.status === "completed") return null;
  return { ba, invite };
}

/** Server-side guard for organizer-only actions. Throws for interns and signed-out callers. */
export async function requireOrganizer() {
  const s = await getSession();
  if (!s || s.role === "intern") throw new Error("Only organizers can do this.");
  return s;
}

export const homeFor = (role: Session["role"]) => (role === "intern" ? "/me" : "/dashboard");
