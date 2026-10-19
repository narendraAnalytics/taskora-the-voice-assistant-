"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hand, LogIn, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";

const PETALS = ["bg-haldi", "bg-tulsi", "bg-saffron", "bg-haldi", "bg-tulsi", "bg-saffron", "bg-haldi", "bg-tulsi"];

/** Where an intern lands after signing out: a warm goodbye and one clear way back in. */
export function SignedOutCard() {
  const reduce = useReducedMotion();
  const [first, setFirst] = useState("");

  // The workspace stores the first name just before signing out; it never travels in the URL.
  useEffect(() => {
    try {
      setFirst(sessionStorage.getItem("taskora-last-intern") ?? "");
      sessionStorage.removeItem("taskora-last-intern");
    } catch {
      /* storage blocked: the page works without the name */
    }
  }, []);

  return (
    <AuthFrame>
      <div className="relative">
        {!reduce &&
          PETALS.map((tone, i) => {
            const a = (i / PETALS.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                className={`absolute left-1/2 top-16 size-2.5 rounded-full ${tone}`}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0.9 }}
                animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 90 - 10, scale: [0, 1, 0.7], opacity: [0.9, 0.9, 0] }}
                transition={{ duration: 1.2, delay: 0.25, ease: "easeOut" }}
              />
            );
          })}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 0.5 }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          className="rounded-[2rem] bg-paper-deep/80 p-6 text-center ring-2 ring-neem/20 shadow-[0_8px_0_rgba(23,63,48,0.14)] backdrop-blur-sm sm:p-8"
        >
          <motion.span
            className="mx-auto grid size-20 origin-bottom-right place-items-center rounded-full bg-haldi ring-4 ring-neem"
            animate={reduce ? undefined : { rotate: [0, 14, -8, 14, -4, 0] }}
            transition={{ duration: 1.4, delay: 0.4, ease: "easeInOut" }}
          >
            <Hand className="size-9" aria-hidden />
          </motion.span>

          <h1 className="font-hand mt-4 text-5xl font-bold leading-none">{first ? `See you soon, ${first}!` : "See you soon!"}</h1>
          <p className="font-note mt-3 text-base text-moss">You are signed out. Your updates are saved and your organizer can still see your progress.</p>

          <Link
            href="/intern-login"
            autoFocus
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30]"
          >
            <LogIn className="size-5" aria-hidden />
            Sign back in
          </Link>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-moss">
            <ShieldCheck className="size-4" aria-hidden />
            No password. We email you a one-time link.
          </p>

          <Link href="/" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline decoration-saffron decoration-2 underline-offset-4">
            Visit the Taskora home page
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </AuthFrame>
  );
}
