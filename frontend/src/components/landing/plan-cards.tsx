"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
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

  // How many interns the organizer is planning for. The plan that fits it is lifted, and the seat board fills to match.
  const [batch, setBatch] = useState(18);
  const fit = PLANS.find((p) => batch <= p.members) ?? PLANS[PLANS.length - 1];
  const perIntern = Math.max(1, Math.round(fit.rupees / batch));
  const reduce = useReducedMotion();
  const board = useRef<HTMLDivElement>(null);
  const seen = useInView(board, { once: true, margin: "0px 0px -15% 0px" });
  // The seats sweep in once when the board scrolls into view; after that they follow the slider at once.
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const t = window.setTimeout(() => setSwept(true), 1600);
    return () => window.clearTimeout(t);
  }, [seen]);
  const filled = seen || reduce ? batch : 0;

  return (
    <>
      <div className="mt-12 grid gap-8 overflow-hidden rounded-[2rem] bg-neem p-6 text-paper sm:p-9 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
        <div className="flex flex-col">
          <label htmlFor="batch-size" className="font-note text-xl text-sage">
            How many interns this term?
          </label>
          <p className="mt-3 flex items-baseline gap-3" aria-live="polite">
            <span className="display-wide text-7xl leading-none text-haldi tabular-nums sm:text-8xl">{batch}</span>
            <span className="font-note text-xl">{batch === 1 ? "intern" : "interns"}</span>
          </p>
          <input
            id="batch-size"
            type="range"
            min={1}
            max={100}
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="mt-6 h-2 w-full cursor-pointer accent-saffron focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron"
          />
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Common batch sizes">
            {[2, 10, 25, 60, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBatch(n)}
                aria-pressed={batch === n}
                className={`rounded-full px-3.5 py-1 text-sm font-bold transition-colors ${batch === n ? "bg-haldi text-neem" : "bg-neem-soft text-paper hover:bg-haldi hover:text-neem"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-auto pt-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={fit.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="font-hand text-4xl font-bold leading-tight text-haldi sm:text-5xl"
              >
                {fit.name} fits your batch.
              </motion.p>
            </AnimatePresence>
            <p className="font-note mt-2 text-lg">
              {fit.price} {fit.id === "starter" ? "for the team" : fit.id === "program" ? "per batch, per month" : "a month for the whole team"}, so about{" "}
              <span className="font-bold text-haldi">₹{perIntern}</span> per intern. Add more interns and that number only goes down.
            </p>
          </div>
        </div>

        <div>
          <div ref={board} className="grid grid-cols-10 gap-1.5 sm:gap-2" role="img" aria-label={`${batch} of 100 seats filled. ${fit.name} plan fits.`}>
            {Array.from({ length: 100 }, (_, i) => {
              const on = i < filled;
              const zone = i < 2 ? "starter" : i < 25 ? "team" : "program";
              return (
                <span
                  key={i}
                  aria-hidden
                  style={!reduce && !swept ? { transitionDelay: `${i * 12}ms` } : undefined}
                  className={`relative aspect-square rounded-t-[45%] rounded-b-md transition-[background-color,transform] duration-300 ${
                    on ? "scale-100 bg-haldi" : zone === "starter" ? "scale-90 bg-tulsi/35" : zone === "team" ? "scale-90 bg-sage/25" : "scale-90 bg-sage/12"
                  }`}
                />
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-sage">
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-t-[45%] rounded-b-sm bg-tulsi/60" /> First 2 seats: Starter
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-t-[45%] rounded-b-sm bg-sage/45" /> Up to 25: Team
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-t-[45%] rounded-b-sm bg-sage/25" /> Up to 100: Program
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = mine?.plan === p.id;
          const fits = p.id === fit.id;
          return (
            <motion.article
              key={p.id}
              layout={!reduce}
              animate={{ y: fits && !reduce ? -10 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className={`relative flex flex-col rounded-[1.75rem] p-7 transition-colors duration-300 sm:p-8 ${
                fits ? "bg-saffron text-neem shadow-[0_18px_40px_-18px_#173f3080]" : "bg-paper-deep/70 text-neem"
              }`}
            >
              <div className="flex min-h-8 flex-wrap items-center gap-2">
                {fits && (
                  <motion.span layoutId={reduce ? undefined : "fits-tag"} className="rounded-full bg-neem px-3 py-1 text-xs font-bold text-haldi">
                    Fits your batch
                  </motion.span>
                )}
                {current && <span className="rounded-full bg-tulsi px-3 py-1 text-xs font-bold text-neem">Your plan</span>}
              </div>
              <h3 className="display mt-3 text-3xl">{p.name}</h3>
              <p className={fits ? "text-neem/80" : "text-moss"}>{p.fit}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="display-wide text-5xl">{p.price}</span>
                {p.period && <span className={fits ? "text-neem/80" : "text-moss"}>{p.period}</span>}
              </p>
              <p className="mt-2 font-bold">Up to {p.members} interns</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.slice(1).map((f) => (
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
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-center font-semibold transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neem ${
                  current ? "bg-tulsi text-neem" : fits ? "bg-neem text-paper hover:bg-neem-soft" : "text-neem ring-2 ring-neem hover:bg-neem hover:text-paper"
                }`}
              >
                {busy === p.id && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {current ? "Your plan" : busy === p.id ? "Opening payment…" : mine?.plan ? `Switch to ${p.name}` : `Choose ${p.name}`}
              </button>
            </motion.article>
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
