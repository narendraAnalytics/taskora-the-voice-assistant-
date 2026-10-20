"use client";

import { useEffect, useState } from "react";
import { Show, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { getMyPlan } from "@/app/billing/actions";
import type { MyPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/landing/logo";

function Greeting() {
  const { user } = useUser();
  const name = user?.username ?? user?.firstName;
  if (!name) return null;
  return (
    <span className="font-note max-w-[10rem] truncate text-lg font-bold sm:max-w-[16rem]">Welcome, {name}</span>
  );
}

/** Shows the organizer's plan once paid ("Starter plan"), or a nudge to pick one. Hidden for interns and while loading. */
function PlanPill() {
  const [mine, setMine] = useState<MyPlan | null | undefined>(undefined);
  useEffect(() => {
    const load = () => void getMyPlan().then(setMine).catch(() => setMine(null));
    load();
    window.addEventListener("taskora-plan", load);
    return () => window.removeEventListener("taskora-plan", load);
  }, []);
  if (!mine) return null;
  return mine.plan ? (
    <a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-haldi px-3 py-1 text-sm font-bold text-neem ring-2 ring-neem/25 hover:bg-saffron">
      <span aria-hidden className="size-2 rounded-full bg-neem" />
      {mine.name} plan
    </a>
  ) : (
    <a href="/pricing" className="inline-flex items-center rounded-full bg-saffron px-3 py-1 text-sm font-bold text-neem ring-2 ring-neem/25 hover:bg-haldi">
      Choose a plan
    </a>
  );
}

const wrap ="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

/**
 * No background. Hidden over the hero video, slides in once the visitor scrolls past it,
 * and flips its ink colour to match whichever section sits under it
 * (sections opt in to a dark surface with `data-nav="dark"`).
 */
export function SiteNav() {
  const [past, setPast] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dark, setDark] = useState(false);
  const { isSignedIn } = useAuth();

  const [introDone, setIntroDone] = useState(false);

  /* The hero announces when the intro video has finished (or was skipped). */
  useEffect(() => {
    const sync = () => setIntroDone(document.documentElement.dataset.intro === "done");
    sync();
    window.addEventListener("taskora-intro", sync);
    return () => window.removeEventListener("taskora-intro", sync);
  }, []);

  useEffect(() => {
    const update = () => {
      setPast(window.scrollY > window.innerHeight * 0.7);
      const under = document
        .elementsFromPoint(window.innerWidth / 2, 36)
        .find((el) => el.closest("[data-nav]"));
      setDark(under?.closest("[data-nav]")?.getAttribute("data-nav") === "dark");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Signed-in members always see their welcome + avatar, even over the hero.
  // Everyone else sees the bar once the intro video has finished playing.
  const shown = past || focused || !!isSignedIn || introDone;

  return (
    <nav
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[transform,color] duration-300 ease-out",
        dark ? "text-paper" : "text-neem",
        shown ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className={`${wrap} flex items-center justify-between py-3`}>
        <a href="#" aria-label="Taskora home">
          <Logo tone={dark ? "paper" : "neem"} />
        </a>
        <div className="flex items-center gap-1 sm:gap-6">
          <a href="#how" className="hidden font-semibold hover:text-saffron md:inline">
            How it works
          </a>
          <a href="#commands" className="hidden font-semibold hover:text-saffron md:inline">
            What you can say
          </a>
          <a href="/pricing" className="hidden font-semibold hover:text-saffron md:inline">
            Pricing
          </a>
          <Show when="signed-out">
            {/* Interns lose the invite email? They can request a fresh one-time link here. */}
            <a href="/intern-login" className="relative inline-flex overflow-hidden rounded-full p-[2.5px] font-semibold">
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 animate-spin bg-[conic-gradient(#f2b33d,#e8622a,#b23a48,#7dbe8f,#f2b33d)] [animation-duration:3s] motion-reduce:animate-none"
              />
              <span className="relative rounded-full bg-paper px-4 py-1.5 text-neem hover:text-saffron">Intern sign in</span>
            </a>
          </Show>
          <Show when="signed-in">
            <PlanPill />
            <Greeting />
            <UserButton />
          </Show>
        </div>
      </div>
    </nav>
  );
}
