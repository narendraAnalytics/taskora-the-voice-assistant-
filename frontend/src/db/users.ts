import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { internInvites, users } from "./schema";

export type UserInput = {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  lastSignInAt?: Date | null;
};

export async function upsertUser(u: UserInput) {
  const values = {
    email: u.email,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    imageUrl: u.imageUrl,
    updatedAt: new Date(),
    ...(u.lastSignInAt ? { lastSignInAt: u.lastSignInAt } : {}),
  };
  await db
    .insert(users)
    .values({ id: u.id, ...values })
    .onConflictDoUpdate({ target: users.id, set: values });

  if (u.email) await claimInvite(u.id, u.email);
}

/** An intern who signs up with an invited email joins that organizer's batch (and keeps their phone). */
async function claimInvite(userId: string, email: string) {
  const claimed = await db
    .update(internInvites)
    .set({ status: "joined", userId, joinedAt: new Date() })
    .where(and(sql`lower(${internInvites.email}) = lower(${email})`, eq(internInvites.status, "invited")))
    .returning({ phone: internInvites.phone });
  const phone = claimed.find((c) => c.phone)?.phone;
  if (phone) await db.update(users).set({ phone }).where(eq(users.id, userId));
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}
