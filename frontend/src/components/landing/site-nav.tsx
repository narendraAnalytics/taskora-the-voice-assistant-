"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/landing/logo";

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

/**
 * No background. Hidden over the hero video, slides in once the visitor scrolls past it,
 * and flips its ink colour to match whichever section sits under it
 * (sections opt in to a dark surface with `data-nav="dark"`).
 */
export function SiteNav() {
  const [past, setPast] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dark, setDark] = useState(false);

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

  const shown = past || focused;

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
          <a href="#pricing" className="hidden font-semibold hover:text-saffron md:inline">
            Pricing
          </a>
          <a
            href="#pilot"
            className="rounded-full bg-haldi px-4 py-2 text-[0.95rem] font-semibold text-neem hover:bg-[#f6c25c]"
          >
            Join the pilot
          </a>
        </div>
      </div>
    </nav>
  );
}
