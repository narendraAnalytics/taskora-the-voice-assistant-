import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** One row per Clerk user. `id` is the Clerk user id. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  /** E.164, copied from the organizer's invite when an intern joins. */
  phone: text("phone"),
  /** organizer | intern | admin — set in Neon, never from the client. New users are interns. */
  role: text("role").$type<"organizer" | "intern" | "admin">().notNull().default("intern"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
});

export type UserRow = typeof users.$inferSelect;

/** Interns an organizer has invited. Sign-up is invitation-only; a joined invite links to the user. */
export const internInvites = pgTable("intern_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  clerkInvitationId: text("clerk_invitation_id"),
  status: text("status").$type<"invited" | "joined" | "revoked">().notNull().default("invited"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
});

export type InviteRow = typeof internInvites.$inferSelect;
