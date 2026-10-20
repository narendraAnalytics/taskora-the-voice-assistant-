import { activateOrder } from "@/lib/billing";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook (events payment.captured and order.paid). It starts the plan even if the buyer closed the
 * tab before the browser confirmed. Add the URL and the same secret as RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, sig)) return new Response("bad signature", { status: 400 });
  try {
    const body = JSON.parse(raw) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
    const pay = body.payload?.payment?.entity;
    if ((body.event === "payment.captured" || body.event === "order.paid") && pay?.id && pay.order_id) {
      await activateOrder(pay.order_id, pay.id);
    }
  } catch {
    return new Response("bad body", { status: 400 });
  }
  return new Response("ok");
}
