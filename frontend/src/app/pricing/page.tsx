import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { PlanCards } from "@/components/landing/plan-cards";

export const metadata = { title: "Plans — Taskora" };

/** The plans on a page of their own, so "See plans" from the dashboard lands right on them. */
export default function PricingPage() {
  return (
    <main className="min-h-svh bg-paper text-neem">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Taskora home">
            <Logo tone="neem" />
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 font-semibold hover:text-saffron">
            <ArrowLeft className="size-4" aria-hidden /> Back to dashboard
          </Link>
        </div>
        <h1 className="font-hand mt-10 bg-gradient-to-r from-neem via-neem-soft to-saffron bg-clip-text text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-none text-transparent">
          Choose your plan
        </h1>
        <p className="font-note mt-4 max-w-[38rem] text-lg text-moss">
          Priced per team, not per seat. Every team starts on a paid plan, and you can switch any time.
        </p>
        <div className="pb-16">
          <PlanCards />
        </div>
      </div>
    </main>
  );
}
