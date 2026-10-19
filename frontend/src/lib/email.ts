import "server-only";
import { Resend } from "resend";
import { InviteEmail, type InviteEmailProps } from "@/emails/invite-email";
import { LoginEmail } from "@/emails/login-email";
import { TaskEmail, type TaskEmailProps } from "@/emails/task-email";

/** Must be an address on a domain verified in Resend, e.g. "Taskora <hello@buildflows.shop>". */
const FROM = process.env.RESEND_FROM ?? "Taskora <onboarding@resend.dev>";

async function send(to: string, subject: string, react: React.ReactElement): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "Email is not set up yet (RESEND_API_KEY is missing).";
  const { error } = await new Resend(key).emails.send({ from: FROM, to, subject, react });
  return error ? `Could not send the email: ${error.message}` : null;
}

/** Branded invite email. Returns an error message, or null on success. */
export function sendInviteEmail(to: string, props: InviteEmailProps) {
  return send(to, "Team added you to their intern batch on Taskora", InviteEmail(props));
}

/** Sign-in link for an intern who already joined. */
export function sendLoginEmail(to: string, name: string, url: string) {
  return send(to, "Your Taskora sign-in link", LoginEmail({ name, url }));
}

/** "New task" email, sent only when the organizer asks for it by voice. */
export function sendTaskEmail(to: string, props: TaskEmailProps) {
  return send(to, `New task: ${props.title}`, TaskEmail(props));
}
