"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SpeechMode } from "@/lib/use-speech";

/*
 * Taskora's face: a flat paper-cut human drawn in SVG. Everything that moves is written straight
 * to SVG attributes from one rAF loop (no React renders): the mouth opens with the live audio
 * level, the head sways and nods, eyes blink and glance, brows lift when listening, and the eyes
 * look up while it thinks. Palette only: no white, no black, no blue.
 */

const SKIN = "#c98f5f";
const SKIN_SHADE = "#b5794b";
const HAIR = "#3b2416";
const MOUTH_IN = "#5a1a22";
const CX = 120;
const CY = 196;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function mouthPath(open: number, round: number, smile: number) {
  const hw = lerp(24, 15, round) + open * 3; // half width: rounder vowels are narrower
  const yc = CY - 3 * smile + open * 1.5; // corners lift with a smile
  const yt = CY + 3 - open * 4; // upper lip
  const yb = CY + 6 + open * 36; // lower lip
  return `M${CX - hw} ${yc}Q${CX} ${yt} ${CX + hw} ${yc}Q${CX} ${yb} ${CX - hw} ${yc}Z`;
}

export function TalkingFace({
  mode,
  levelRef,
  className,
}: {
  mode: SpeechMode;
  levelRef: RefObject<number>;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const modeRef = useRef(mode);
  const head = useRef<SVGGElement>(null);
  const mouth = useRef<SVGPathElement>(null);
  const clip = useRef<SVGPathElement>(null);
  const teeth = useRef<SVGRectElement>(null);
  const tongue = useRef<SVGEllipseElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const lids = useRef<SVGGElement>(null);
  const brows = useRef<SVGGElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let open = 0;
    let nextBlink = performance.now() + 1800;
    let blinkStart = -1;
    let gx = 0;
    let gy = 0;
    let gTx = 0;
    let gTy = 0;
    let nextGlance = 0;
    let lift = 0;
    let tilt = 0;
    let nod = 0;

    const frame = (now: number) => {
      const m = modeRef.current;
      const t = now / 1000;
      const level = clamp(levelRef.current ?? 0);

      // Mouth: follow loudness fast on the way up, slower on the way down.
      const target = m === "speaking" ? clamp(level * 1.5) : 0;
      open += (target - open) * (target > open ? 0.45 : 0.22);
      const round = m === "speaking" ? 0.5 + 0.5 * Math.sin(t * 8.3 + Math.sin(t * 3.1) * 2) : 0.3;
      const smile = m === "speaking" ? 0.3 : m === "listening" ? 1 : 0.7;
      const d = mouthPath(open, round, smile);
      mouth.current?.setAttribute("d", d);
      clip.current?.setAttribute("d", d);
      mouth.current?.setAttribute("fill", open > 0.07 ? MOUTH_IN : "#b23a48");
      teeth.current?.setAttribute("height", String(clamp(open * 14, 0, 9)));
      tongue.current?.setAttribute("cy", String(CY + 6 + open * 30));
      tongue.current?.setAttribute("opacity", open > 0.25 ? "1" : "0");

      // Blink every few seconds.
      if (blinkStart < 0 && now > nextBlink) blinkStart = now;
      let lid = 0;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / 160;
        lid = p >= 1 ? 0 : Math.sin(p * Math.PI);
        if (p >= 1) {
          blinkStart = -1;
          nextBlink = now + 2200 + Math.random() * 3200;
        }
      }
      lids.current?.setAttribute("transform", `translate(0 ${-18 + lid * 18})`);

      // Eyes: glance around when idle, look up-right while thinking, meet your gaze when listening.
      if (now > nextGlance) {
        gTx = m === "idle" ? (Math.random() - 0.5) * 7 : m === "thinking" ? 6 : (Math.random() - 0.5) * 2;
        gTy = m === "thinking" ? -5 : (Math.random() - 0.5) * 3;
        nextGlance = now + 900 + Math.random() * 1800;
      }
      gx += (gTx - gx) * 0.12;
      gy += (gTy - gy) * 0.12;
      eyes.current?.setAttribute("transform", `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`);

      // Brows rise when listening, slant when thinking, bounce a little with speech.
      const browTarget = m === "listening" ? -6 : m === "thinking" ? -3 : -open * 4;
      lift += (browTarget - lift) * 0.15;
      brows.current?.setAttribute("transform", `translate(0 ${lift.toFixed(2)})`);

      // Head: always breathing; leans in while listening; nods with the voice.
      const tiltTarget = m === "listening" ? 4 : m === "thinking" ? -4 : Math.sin(t * 0.7) * 1.2;
      tilt += (tiltTarget - tilt) * 0.08;
      nod += ((m === "speaking" ? level * 5 : 0) - nod) * 0.2;
      const bob = Math.sin(t * 1.6) * 1.6;
      head.current?.setAttribute(
        "transform",
        `translate(0 ${(bob + nod).toFixed(2)}) rotate(${tilt.toFixed(2)} ${CX} 260)`,
      );

      if (halo.current) {
        const base = m === "listening" ? 1.06 : 1;
        halo.current.style.transform = `scale(${(base + (m === "speaking" ? level : 0) * 0.18).toFixed(3)})`;
        halo.current.style.opacity = m === "idle" ? "0.55" : "0.9";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce, levelRef]);

  return (
    <div className={cn("relative grid place-items-center", className)} role="img" aria-label={`Taskora is ${mode}`}>
      <div
        ref={halo}
        aria-hidden
        className="absolute inset-[4%] rounded-full bg-gradient-to-br from-tulsi/70 via-haldi/50 to-saffron/60 blur-[2px] transition-[opacity] duration-300"
      />
      {mode === "listening" &&
        !reduce &&
        [0, 0.7, 1.4].map((d) => (
          <motion.span
            key={d}
            aria-hidden
            className="absolute inset-[8%] rounded-full ring-2 ring-haldi/60"
            initial={{ scale: 0.9, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2.1, repeat: Infinity, delay: d, ease: "easeOut" }}
          />
        ))}
      <svg viewBox="0 0 240 280" className="relative size-full overflow-visible" aria-hidden>
        <defs>
          <clipPath id="face-circle">
            <circle cx="120" cy="140" r="112" />
          </clipPath>
          <clipPath id="mouth-clip">
            <path ref={clip} d={mouthPath(0, 0.3, 0.7)} />
          </clipPath>
        </defs>
        <circle cx="120" cy="140" r="112" fill="#7dbe8f" opacity="0.35" />
        <g clipPath="url(#face-circle)">
          {/* shoulders: haldi kurta with a saffron collar */}
          <path d="M-10 300V262C-10 238 40 226 78 222L120 244L162 222C200 226 250 238 250 262V300Z" fill="#f2b33d" />
          <path d="M78 222L120 260L162 222L120 244Z" fill="#e8622a" />
          <g ref={head}>
            {/* neck */}
            <path d="M98 205H142V236C142 246 98 246 98 236Z" fill={SKIN_SHADE} />
            {/* ears */}
            <ellipse cx="53" cy="150" rx="9" ry="15" fill={SKIN_SHADE} />
            <ellipse cx="187" cy="150" rx="9" ry="15" fill={SKIN_SHADE} />
            {/* hair behind the head */}
            <path d="M52 140C42 70 82 30 120 30C158 30 198 70 188 140C176 100 160 84 120 84C80 84 64 100 52 140Z" fill={HAIR} />
            {/* head */}
            <path d="M58 128C58 76 88 52 120 52C152 52 182 76 182 128C182 178 156 224 120 224C84 224 58 178 58 128Z" fill={SKIN} />
            {/* fringe */}
            <path d="M56 124C54 72 84 40 122 42C160 44 188 76 184 126C176 102 164 82 138 76C112 88 86 88 70 100C64 106 60 114 56 124Z" fill={HAIR} />
            {/* cheeks */}
            <circle cx="82" cy="176" r="13" fill="#e8622a" opacity="0.22" />
            <circle cx="158" cy="176" r="13" fill="#e8622a" opacity="0.22" />
            {/* brows */}
            <g ref={brows} fill="none" stroke={HAIR} strokeWidth="5" strokeLinecap="round">
              <path d="M78 118Q92 108 106 116" />
              <path d="M134 116Q148 108 162 118" />
            </g>
            {/* eyes: paper whites, neem irises, lids slide down to blink */}
            <g>
              <ellipse cx="92" cy="138" rx="14" ry="11" fill="#fce7b2" />
              <ellipse cx="148" cy="138" rx="14" ry="11" fill="#fce7b2" />
              <g ref={eyes}>
                <circle cx="92" cy="138" r="7" fill="#173f30" />
                <circle cx="148" cy="138" r="7" fill="#173f30" />
                <circle cx="94.5" cy="135.5" r="2" fill="#fce7b2" />
                <circle cx="150.5" cy="135.5" r="2" fill="#fce7b2" />
              </g>
              <g ref={lids} transform="translate(0 -18)">
                <rect x="74" y="116" width="36" height="22" fill={SKIN} />
                <rect x="130" y="116" width="36" height="22" fill={SKIN} />
              </g>
              <path d="M78 138Q92 126 106 138" fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
              <path d="M134 138Q148 126 162 138" fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            </g>
            {/* nose */}
            <path d="M120 142Q112 170 108 176Q120 184 132 176Q128 170 120 142Z" fill={SKIN_SHADE} opacity="0.55" />
            {/* mouth */}
            <path ref={mouth} d={mouthPath(0, 0.3, 0.7)} fill="#b23a48" stroke="#b23a48" strokeWidth="3" strokeLinejoin="round" />
            <g clipPath="url(#mouth-clip)">
              <rect ref={teeth} x="90" y={CY - 1} width="60" height="0" fill="#fce7b2" />
              <ellipse ref={tongue} cx="120" cy={CY + 6} rx="15" ry="9" fill="#b23a48" opacity="0" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
