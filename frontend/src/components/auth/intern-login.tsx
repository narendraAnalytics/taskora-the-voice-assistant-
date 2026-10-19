"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Info, Mail, MailCheck } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { authClient } from "@/lib/auth-client";

const card = "rounded-[2rem] bg-paper-deep/80 p-6 ring-2 ring-neem/20 shadow-[0_8px_0_rgba(23,63,48,0.14)] backdrop-blur-sm sm:p-8";

/** Intern sign-in: type your email, get a one-time link. Same message whether or not the email is on a batch. */
export function InternLogin({ linkProblem }: { linkProblem: boolean }) {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email your invite was sent to.");
    setError("");
    setState("sending");
    // Unknown emails fail inside Better Auth (sign-up is off); the screen stays the same on purpose.
    await authClient.signIn
      .magicLink({ email: email.trim().toLowerCase(), callbackURL: "/me", errorCallbackURL: "/intern-login?error=link" })
      .catch(() => {});
    setState("sent");
  };

  return (
    <AuthFrame>
      <motion.div className={card} initial={reduce ? false : { opacity: 0, y: 14, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          {state === "sent" ? (
            <motion.div key="sent" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status" className="text-center">
              <motion.span
                className="mx-auto grid size-20 place-items-center rounded-full bg-tulsi ring-4 ring-neem"
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
              >
                <MailCheck className="size-9" aria-hidden />
              </motion.span>
              <h1 className="font-hand mt-4 text-5xl font-bold leading-none">Check your inbox</h1>
              <p className="font-note mt-3 text-base text-moss">
                If <strong className="text-neem">{email.trim()}</strong> is on a Taskora batch, a sign-in link is on its way. It works once.
              </p>
              <button type="button" onClick={() => setState("idle")} className="mt-5 text-sm font-bold underline decoration-saffron decoration-2 underline-offset-4">
                Use a different email
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} initial={false} className="space-y-4">
              <div>
                <h1 className="font-hand text-5xl font-bold leading-none">Intern sign in</h1>
                <p className="font-note mt-2 text-base text-moss">No password. We email you a one-time link.</p>
              </div>
              {linkProblem && (
                <p role="alert" className="flex items-start gap-2 rounded-xl bg-haldi px-4 py-2.5 text-sm font-semibold">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  That link has expired or was already used. Enter your email for a fresh one.
                </p>
              )}
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Email address</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-moss" aria-hidden />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ravi@college.edu"
                    autoComplete="email"
                    autoFocus
                    className="h-12 w-full rounded-2xl bg-paper/70 pl-11 pr-4 text-neem ring-1 ring-neem/20 placeholder:text-moss focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                  />
                </span>
              </label>
              {error && (
                <p role="alert" className="rounded-xl bg-kumkum px-4 py-2.5 text-sm font-semibold text-paper">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30] disabled:opacity-60"
              >
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
                <ArrowRight className="size-5" aria-hidden />
              </button>
              <p className="text-center text-sm text-moss">Only interns added by an organizer can sign in.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthFrame>
  );
}
