import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { deleteUser, upsertUser } from "@/db/users";

// Keeps Neon in step when a profile changes or is deleted in Clerk.
// Needs CLERK_WEBHOOK_SIGNING_SECRET and a webhook in the Clerk dashboard pointing at
// https://<your-domain>/api/webhooks/clerk (events: user.created, user.updated, user.deleted).
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const d = evt.data;
    const primary = d.email_addresses.find((e) => e.id === d.primary_email_address_id);
    await upsertUser({
      id: d.id,
      email: primary?.email_address ?? null,
      username: d.username,
      firstName: d.first_name,
      lastName: d.last_name,
      imageUrl: d.image_url,
    });
  } else if (evt.type === "user.deleted" && evt.data.id) {
    await deleteUser(evt.data.id);
  }
  return new Response("ok");
}
