import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { internInvites, paymentOrders, subscriptions } from "@/db/schema";
import { PLAN_DAYS, planById, type MyPlan } from "@/lib/plans";

const DAY = 86_400_000;

/** Interns that count against the plan: invited or joined (completed and revoked do not). */
async function usedBy(organizerId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(internInvites)
    .where(and(eq(internInvites.organizerId, organizerId), inArray(internInvites.status, ["invited", "joined"])));
  return r?.n ?? 0;
}

export async function planFor(organizerId: string): Promise<MyPlan> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.organizerId, organizerId), gt(subscriptions.expiresAt, new Date())))
    .limit(1);
  const plan = sub ? planById(sub.plan) : undefined;
  return {
    plan: plan?.id ?? null,
    name: plan?.name ?? null,
    limit: plan?.members ?? 0,
    used: await usedBy(organizerId),
    expiresAt: sub && plan ? sub.expiresAt.toISOString() : null,
  };
}

/**
 * An error message when this organizer cannot take on `extra` more interns, else null.
 * Admins are not limited. No plan means no interns: there is no free plan.
 */
export async function capacityError(organizerId: string, role: string, extra = 1): Promise<string | null> {
  if (role === "admin") return null;
  const p = await planFor(organizerId);
  if (!p.plan) return "Choose a plan on the pricing page to add interns.";
  if (p.used + extra > p.limit) return `Your ${p.name} plan allows up to ${p.limit} interns. Upgrade your plan to add more.`;
  return null;
}

/**
 * Mark an order paid and start or extend the plan. Safe to call twice (browser and webhook both call it):
 * only the call that flips `created` to `paid` changes anything.
 */
export async function activateOrder(orderId: string, paymentId: string, organizerId?: string): Promise<MyPlan | null> {
  const [order] = await db
    .update(paymentOrders)
    .set({ status: "paid", paymentId, paidAt: new Date() })
    .where(and(eq(paymentOrders.orderId, orderId), eq(paymentOrders.status, "created"), ...(organizerId ? [eq(paymentOrders.organizerId, organizerId)] : [])))
    .returning();
  if (!order) {
    const [done] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderId, orderId)).limit(1);
    return done && done.status === "paid" && (!organizerId || done.organizerId === organizerId) ? planFor(done.organizerId) : null;
  }
  const now = Date.now();
  const [current] = await db.select().from(subscriptions).where(eq(subscriptions.organizerId, order.organizerId)).limit(1);
  // Paying again for the same plan extends it; a different plan starts now.
  const same = current && current.plan === order.plan;
  const base = same && current.expiresAt.getTime() > now ? current.expiresAt.getTime() : now;
  const expiresAt = new Date(base + PLAN_DAYS * DAY);
  await db
    .insert(subscriptions)
    .values({ organizerId: order.organizerId, plan: order.plan, expiresAt, lastPaymentId: paymentId })
    .onConflictDoUpdate({
      target: subscriptions.organizerId,
      set: { plan: order.plan, expiresAt, lastPaymentId: paymentId, startedAt: same ? current.startedAt : new Date() },
    });
  return planFor(order.organizerId);
}
