"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Check, LoaderCircle } from "lucide-react";
import { confirmPayment, getMyPlan, startCheckout } from "@/app/billing/actions";
import { PLANS, type MyPlan, type Plan } from "@/lib/plans";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string };
  theme?: { color: string };
  handler: (r: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

/** Loads Razorpay's checkout script once, only when someone clicks a plan. */
function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Tells the navbar and anything else that the plan changed. */
export const announcePlan = () => window.dispatchEvent(new Event("taskora-plan"));

/** The three paid plans. There is no free plan: each button opens Razorpay Checkout (test mode while test keys are set). */
export function PlanCards() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  const router = useRouter();
  const [mine, setMine] = useState<MyPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const refresh = useCallback(async () => setMine(isSignedIn ? await getMyPlan().catch(() => null) : null), [isSignedIn]);
  useEffect(() => {
    void refresh();
    window.addEventListener("taskora-plan", refresh);
    return () => window.removeEventListener("taskora-plan", refresh);
  }, [refresh]);

  const choose = async (p: Plan) => {
    setNote(null);
    if (!isSignedIn) {
      let returning = false;
      try {
        returning = localStorage.getItem("taskora-returning") === "1";
      } catch {}
      return void (returning ? openSignIn() : openSignUp());
    }
    setBusy(p.id);
    const r = await startCheckout(p.id).catch(() => ({ ok: false as const, error: "Could not start the payment." }));
    if (!r.ok) {
      setBusy(null);
      return setNote({ tone: "bad", text: r.error });
    }
    if (!(await loadCheckout()) || !window.Razorpay) {
      setBusy(null);
      return setNote({ tone: "bad", text: "Could not load the payment window. Check your connection." });
    }
    const c = r.checkout;
    const rz = new window.Razorpay({
      key: c.keyId,
      amount: c.amount,
      currency: "INR",
      order_id: c.orderId,
      name: "Taskora",
      description: `${c.planName} plan, 30 days`,
      prefill: { name: c.name },
      theme: { color: "#e8622a" },
      modal: { ondismiss: () => setBusy(null) },
      handler: async (res) => {
        const done = await confirmPayment({ orderId: res.razorpay_order_id, paymentId: res.razorpay_payment_id, signature: res.razorpay_signature }).catch(() => ({
          ok: false as const,
          error: "Payment went through but we could not confirm it. Refresh in a minute; your plan will start.",
        }));
        setBusy(null);
        if (!done.ok) return setNote({ tone: "bad", text: done.error });
        setMine(done.plan);
        announcePlan();
        setNote({ tone: "ok", text: `${done.plan.name} plan is active. You can add up to ${done.plan.limit} interns.` });
        router.push("/dashboard");
      },
    });
    rz.on("payment.failed", (e) => {
      setBusy(null);
      setNote({ tone: "bad", text: e.error?.description ?? "The payment did not go through. You have not been charged." });
    });
    rz.open();
  };

  return (
    <>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = mine?.plan === p.id;
          return (
            <div key={p.id} className={`flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${p.featured ? "bg-saffron text-neem" : "bg-paper-deep/70 text-neem"}`}>
              <h3 className="display text-2xl">{p.name}</h3>
              <p className={p.featured ? "text-neem/80" : "text-moss"}>{p.fit}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="display-wide text-5xl">{p.price}</span>
                {p.period && <span className={p.featured ? "text-neem/80" : "text-moss"}>{p.period}</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-1 size-4 shrink-0" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={busy !== null || current}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-center font-semibold transition-colors disabled:opacity-70 ${
                  current ? "bg-tulsi text-neem" : p.featured ? "bg-neem text-paper hover:bg-neem-soft" : "text-neem ring-2 ring-neem hover:bg-neem hover:text-paper"
                }`}
              >
                {busy === p.id && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {current ? "Your plan" : busy === p.id ? "Opening payment…" : mine?.plan ? `Switch to ${p.name}` : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
      {note && (
        <p role="status" className={`font-note mt-6 rounded-2xl px-5 py-3 text-lg font-semibold ${note.tone === "ok" ? "bg-tulsi text-neem" : "bg-kumkum text-paper"}`}>
          {note.text}
        </p>
      )}
    </>
  );
}
