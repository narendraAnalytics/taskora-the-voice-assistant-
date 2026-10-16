import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

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
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}
