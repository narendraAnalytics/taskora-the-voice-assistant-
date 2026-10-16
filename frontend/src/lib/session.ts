import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { upsertUser } from "@/db/users";

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
  const { userId } = await auth();
  if (!userId) return null;

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

/** Server-side guard for organizer-only actions. Throws for interns and signed-out callers. */
export async function requireOrganizer() {
  const s = await getSession();
  if (!s || s.role === "intern") throw new Error("Only organizers can do this.");
  return s;
}

export const homeFor = (role: Session["role"]) => (role === "intern" ? "/me" : "/dashboard");
