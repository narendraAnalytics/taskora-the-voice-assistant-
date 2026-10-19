"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, GraduationCap, Languages, Mic, School, Sparkles } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Avatar } from "@/components/dashboard/status-chip";

const PETALS = ["bg-haldi", "bg-saffron", "bg-tulsi", "bg-kumkum", "bg-haldi", "bg-tulsi", "bg-saffron", "bg-kumkum", "bg-haldi", "bg-tulsi", "bg-saffron", "bg-kumkum"];

type Props = {
  name: string;
  position: string | null;
  college: string | null;
  months: number | null;
  startDate: string | null;
  language: string | null;
  skills: string[];
};

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Shown once the invite link signs the intern in: a welcome, their details and what happens next. */
export function WelcomeCard({ name, position, college, months, startDate, language, skills }: Props) {
  const reduce = useReducedMotion();
  const first = name.split(" ")[0];
  const when = [months ? `${months} month${months > 1 ? "s" : ""}` : "", startDate ? `from ${fmt(startDate)}` : ""].filter(Boolean).join(" · ");
  const steps = ["Give a 20-second voice update each day, in the language you like.", "Taskora turns it into task updates.", "Your organizer sees the board, with no chasing."];

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
                className={`absolute left-1/2 top-24 size-3 rounded-full ${tone}`}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: Math.cos(a) * 170, y: Math.sin(a) * 110, scale: [0, 1.2, 0.8], opacity: [1, 1, 0] }}
                transition={{ duration: 1.3, delay: 0.3, ease: "easeOut" }}
              />
            );
          })}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -0.5 }}
          transition={{ type: "spring", stiffness: 160, damping: 16 }}
          className="rounded-[2rem] bg-paper-deep/80 p-6 text-center ring-2 ring-neem/20 shadow-[0_8px_0_rgba(23,63,48,0.14)] backdrop-blur-sm sm:p-8"
        >
          <Avatar name={name} className="mx-auto size-20 text-3xl ring-4 ring-paper" />
          <h1 className="font-hand mt-4 text-5xl font-bold leading-none">Welcome, {first}!</h1>
          <p className="font-note mt-3 text-base text-moss">You are in. Your batch is waiting for you on Taskora.</p>

          {(position || college || when || language || skills.length > 0) && (
            <dl className="mx-auto mt-5 max-w-xs space-y-2 rounded-2xl bg-paper px-4 py-3.5 text-left text-sm">
              {position && (
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 shrink-0 text-moss" aria-hidden />
                  <dd className="font-bold">{position}</dd>
                </div>
              )}
              {college && (
                <div className="flex items-center gap-2.5">
                  <School className="size-4 shrink-0 text-moss" aria-hidden />
                  <dd>{college}</dd>
                </div>
              )}
              {when && (
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="size-4 shrink-0 text-moss" aria-hidden />
                  <dd>{when}</dd>
                </div>
              )}
              {language && (
                <div className="flex items-center gap-2.5">
                  <Languages className="size-4 shrink-0 text-moss" aria-hidden />
                  <dd>Standups in {language}</dd>
                </div>
              )}
              {skills.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <GraduationCap className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                  <dd className="flex flex-wrap gap-1">
                    {skills.map((s) => (
                      <span key={s} className="rounded-full bg-tulsi px-2 py-0.5 text-xs font-semibold">
                        {s}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm">
            {steps.map((t, i) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-haldi text-xs font-extrabold ring-1 ring-neem/30">
                  {i === 0 ? <Mic className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>

          <Link
            href="/me"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30]"
          >
            Open my workspace
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </AuthFrame>
  );
}
