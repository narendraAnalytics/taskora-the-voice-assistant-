import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Payments are not set up yet (Razorpay keys are missing).");
  return { id, secret };
}

export const razorpayKeyId = () => keys().id;

/** Create a Razorpay order. The amount is in paise and always comes from our own plan list. */
export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<{ id: string }> {
  const { id, secret } = keys();
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not start the payment. Try again in a moment.");
  return (await res.json()) as { id: string };
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout signature: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", keys().secret).update(`${orderId}|${paymentId}`).digest("hex");
  return same(expected, signature);
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return same(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}
