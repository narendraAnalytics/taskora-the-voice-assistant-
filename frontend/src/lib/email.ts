import "server-only";
import { Resend } from "resend";
import { InviteEmail, type InviteEmailProps } from "@/emails/invite-email";

/** Must be an address on a domain verified in Resend, e.g. "Taskora <hello@buildflows.shop>". */
const FROM = process.env.RESEND_FROM ?? "Taskora <onboarding@resend.dev>";

/** Sends the branded invite email. Returns an error message, or null on success. */
export async function sendInviteEmail(to: string, props: InviteEmailProps): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "Email is not set up yet (RESEND_API_KEY is missing).";
  const { error } = await new Resend(key).emails.send({
    from: FROM,
    to,
    subject: `${props.organizerName} added you to their intern batch on Taskora`,
    react: InviteEmail(props),
  });
  return error ? `Could not send the email: ${error.message}` : null;
}
