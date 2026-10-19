import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { and, desc, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { baAccount, baSession, baUser, baVerification } from "@/db/auth-schema";
import { internInvites } from "@/db/schema";
import { BASE_URL } from "@/lib/base-url";
import { sendInviteEmail, sendLoginEmail } from "@/lib/email";

const pinned = (url: string) => {
  const u = new URL(url);
  return new URL(u.pathname + u.search, BASE_URL).toString();
};

/**
 * Intern login (organizers use Clerk). Sign-in is by emailed magic link only, and sign-up is off:
 * an intern's account is created by `inviteIntern`, so only invited emails can ever get in.
 * The email content is looked up here from the database and never taken from the request.
 */
export const auth = betterAuth({
  baseURL: BASE_URL,
  trustedOrigins: [BASE_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: baUser, session: baSession, account: baAccount, verification: baVerification },
  }),
  plugins: [
    magicLink({
      disableSignUp: true,
      // An invite link must outlive a normal sign-in code; links are single-use.
      expiresIn: 60 * 60 * 24 * 7,
      sendMagicLink: async ({ email, url: rawUrl }) => {
        const url = pinned(rawUrl);
        const [invite] = await db
          .select()
          .from(internInvites)
          .where(and(sql`lower(${internInvites.email}) = lower(${email})`, ne(internInvites.status, "revoked")))
          .orderBy(desc(internInvites.invitedAt))
          .limit(1);
        // No live invite, or access ended: say nothing (the caller sees a generic success).
        if (!invite || invite.status === "completed") return;

        const name = invite.name ?? email;
        const error =
          invite.status === "invited"
            ? await sendInviteEmail(email, {
                internName: name,
                acceptUrl: url,
                position: invite.position,
                college: invite.college,
                duration: invite.durationMonths ? `${invite.durationMonths} month${invite.durationMonths > 1 ? "s" : ""}` : null,
                startDate: invite.startDate
                  ? new Date(`${invite.startDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : null,
                language: invite.language,
              })
            : await sendLoginEmail(email, name, url);
        if (error) throw new Error(error);
      },
    }),
    nextCookies(),
  ],
});
