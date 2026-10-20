"use client";

import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A fixed-height scrolling list for feeds that keep growing (standups, messages): the edges fade out where
 * more content is hidden, the scrollbar is a thin palette line, and a "Back to newest" pill appears once
 * you have scrolled down. Items can animate in with `whileInView` and `viewport={{ root }}` using `root`.
 */
export function ScrollFeed({ root, className, children }: { root: RefObject<HTMLDivElement | null>; className?: string; children: ReactNode }) {
  const [top, setTop] = useState(true);
  const [bottom, setBottom] = useState(false);

  const measure = useCallback(() => {
    const el = root.current;
    if (!el) return;
    setTop(el.scrollTop < 8);
    setBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  }, [root]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [root, measure, children]);

  return (
    <div className="relative">
      <div
        ref={root}
        onScroll={measure}
        tabIndex={0}
        aria-label="Scrollable list"
        className={cn("feed-scroll overflow-y-auto overscroll-contain scroll-smooth pr-1 outline-none focus-visible:ring-2 focus-visible:ring-saffron", className)}
        style={{ ["--fade-top" as string]: top ? "0px" : "28px", ["--fade-bottom" as string]: bottom ? "0px" : "36px" }}
      >
        {children}
      </div>
      {!top && (
        <button
          type="button"
          onClick={() => root.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute left-1/2 top-2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-neem px-3.5 py-1.5 text-xs font-bold text-haldi shadow-[0_4px_0_rgba(23,63,48,0.25)] transition-transform hover:-translate-y-0.5"
        >
          <ArrowUp className="size-3.5" aria-hidden /> Back to newest
        </button>
      )}
    </div>
  );
}
