import { baUser } from "./auth-schema";
import { sql } from "drizzle-orm";
import { date, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  position: text("position"),
  college: text("college"),
  degree: text("degree"),
  studyYear: text("study_year"),
  durationMonths: integer("duration_months"),
  /** YYYY-MM-DD */
  startDate: date("start_date"),
  skills: text("skills").array().notNull().default(sql`'{}'`),
  language: text("language"),
  clerkInvitationId: text("clerk_invitation_id"),
  status: text("status").$type<"invited" | "joined" | "completed" | "revoked">().notNull().default("invited"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  /** Better Auth intern account, created when the invite is sent. */
  internUserId: text("intern_user_id").references(() => baUser.id, { onDelete: "set null" }),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type InviteRow = typeof internInvites.$inferSelect;

/** A task an organizer gave to one intern (the intern is identified by their invite row). */
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inviteId: uuid("invite_id")
    .notNull()
    .references(() => internInvites.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /** YYYY-MM-DD */
  dueDate: date("due_date"),
  status: text("status").$type<"todo" | "progress" | "blocked" | "done">().notNull().default("todo"),
  progress: integer("progress").notNull().default(0),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TaskRow = typeof tasks.$inferSelect;

/** Every change to a task, for undo and "what happened to this task?". */
export const taskEvents = pgTable("task_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  actorId: text("actor_id"),
  kind: text("kind").$type<"created" | "reassigned" | "emailed" | "status_changed" | "note">().notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** What an intern told their organizer about a task ("started", "blocked: need the API key"). */
export const standups = pgTable("standups", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  inviteId: uuid("invite_id")
    .notNull()
    .references(() => internInvites.id, { onDelete: "cascade" }),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  /** The task's status after this update. */
  status: text("status").$type<"todo" | "progress" | "blocked" | "done">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A message the organizer sends an intern (shown on the intern's page; optionally about one task). */
export const organizerMessages = pgTable("organizer_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviteId: uuid("invite_id")
    .notNull()
    .references(() => internInvites.id, { onDelete: "cascade" }),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The organizer's Ask Taskora chat, kept so it survives sign out. Only the organizer's eraser button clears it. */
export const organizerChats = pgTable("organizer_chats", {
  organizerId: text("organizer_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  log: jsonb("log").$type<{ from: "you" | "taskora"; text: string }[]>().notNull().default(sql`'[]'`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A Razorpay order we created. Marked paid only after the payment signature (or webhook) is verified. */
export const paymentOrders = pgTable("payment_orders", {
  orderId: text("order_id").primaryKey(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status").$type<"created" | "paid">().notNull().default("created"),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

/** The organizer's current plan. Active while expires_at is in the future. */
export const subscriptions = pgTable("subscriptions", {
  organizerId: text("organizer_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastPaymentId: text("last_payment_id"),
});
