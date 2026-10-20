"use server";

import { z } from "zod";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { activateOrder, planFor } from "@/lib/billing";
import { PLAN_IDS, planById, type MyPlan } from "@/lib/plans";
import { createOrder, razorpayKeyId, verifyPaymentSignature } from "@/lib/razorpay";
import { getSession } from "@/lib/session";

/** The signed-in organizer's plan, or null for visitors and interns. */
export async function getMyPlan(): Promise<MyPlan | null> {
  const s = await getSession();
  if (!s || s.role === "intern") return null;
  return planFor(s.userId);
}

export type Checkout = { keyId: string; orderId: string; amount: number; planName: string; name: string };

/** Step 1: create the Razorpay order for a plan. The price comes from `lib/plans.ts`, never from the browser. */
export async function startCheckout(planId: string): Promise<{ ok: true; checkout: Checkout } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s || s.role === "intern") return { ok: false, error: "Sign in as an organizer to choose a plan." };
  const parsed = z.enum(PLAN_IDS).safeParse(planId);
  const plan = parsed.success ? planById(parsed.data) : undefined;
  if (!plan) return { ok: false, error: "Unknown plan." };
  try {
    const amount = plan.rupees * 100;
    const order = await createOrder(amount, `${plan.id}-${Date.now()}`, { organizer: s.userId, plan: plan.id });
    await db.insert(paymentOrders).values({ orderId: order.id, organizerId: s.userId, plan: plan.id, amountPaise: amount });
    return { ok: true, checkout: { keyId: razorpayKeyId(), orderId: order.id, amount, planName: plan.name, name: s.name } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start the payment." };
  }
}

const confirmSchema = z.object({ orderId: z.string().min(5).max(64), paymentId: z.string().min(5).max(64), signature: z.string().min(10).max(200) });

/** Step 2: after Checkout succeeds, verify the signature on the server, then start the plan. */
export async function confirmPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<{ ok: true; plan: MyPlan } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s || s.role === "intern") return { ok: false, error: "Please sign in again." };
  const p = confirmSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "That payment could not be checked." };
  if (!verifyPaymentSignature(p.data.orderId, p.data.paymentId, p.data.signature)) return { ok: false, error: "The payment signature did not match, so no plan was started." };
  const plan = await activateOrder(p.data.orderId, p.data.paymentId, s.userId);
  return plan ? { ok: true, plan } : { ok: false, error: "We could not find that order." };
}
