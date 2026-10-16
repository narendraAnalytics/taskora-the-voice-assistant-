import { auth, currentUser } from "@clerk/nextjs/server";
import { upsertUser } from "@/db/users";

// Called by the signed-in browser (see UserSync). Stores the Clerk profile in Neon.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  await upsertUser({
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : new Date(),
  });
  return Response.json({ ok: true });
}
