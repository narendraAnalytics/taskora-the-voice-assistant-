"use client";

import Link from "next/link";
import { Logo } from "@/components/landing/logo";

/** Dashboard frame: no site navbar — the logo takes you back to the landing hero. */
export function Shell({
  name,
  role,
  title,
  subtitle,
  action,
  children,
}: {
  action?: React.ReactNode;
  name: string;
  role: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-svh bg-paper text-neem">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,#f2b33d55,transparent),radial-gradient(40rem_30rem_at_-10%_30%,#7dbe8f40,transparent)]"
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Back to the Taskora home page" className="rounded-xl focus-visible:outline-saffron">
            <Logo tone="neem" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-neem px-3 py-1 text-sm font-semibold capitalize text-paper sm:inline">
              {role}
            </span>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-5 sm:mt-10">
          <div>
            <p className="font-note text-lg text-moss">{subtitle}</p>
            <h1 className="font-hand mt-1 bg-gradient-to-r from-neem via-neem-soft to-saffron bg-clip-text text-[clamp(2.8rem,6vw,4.6rem)] font-bold leading-[1] text-transparent">
              {greet}, {name}
            </h1>
            <p className="sr-only">{title}</p>
          </div>
          {action}
        </div>

        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}
