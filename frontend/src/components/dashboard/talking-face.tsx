"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SpeechMode } from "@/lib/use-speech";

/*
 * Taskora's face: a flat paper-cut person in a neem Nehru jacket, drawn in SVG. Everything that
 * moves is written straight to SVG attributes from one rAF loop (no React renders): the mouth opens
 * with the live audio level and rests in a smile, eyes blink, glance and "smile" with the cheeks,
 * brows lift when listening, the head sways and nods. Around the face a liquid aura swells with the
 * voice and two HUD rings turn (fast while thinking). Palette only: no white, no black, no blue.
 */

export type FaceMood = "neutral" | "happy";

const SKIN = "#c98f5f";
const SKIN_SHADE = "#b5794b";
const HAIR = "#3b2416";
const LIPS = "#b23a48";
const MOUTH_IN = "#5a1a22";
const CX = 120;
const CY = 194;
const R = 112; // disc radius
const UPPER_LID = 2; // lids rest a touch low: calm, confident eyes

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** Mouth outline: corners lift with `smile`, lower lip drops with `open`, `round` narrows it. */
function mouthGeo(open: number, round: number, smile: number) {
  const hw = lerp(25, 16, round) + smile * 3 + open * 2;
  const yc = CY - smile * 8 + open * 2;
  const yt = CY + 2 + smile * 2 - open * 5;
  const yb = CY + 6 + smile * 8 + open * 30;
  return { hw, yc, yt, d: `M${CX - hw} ${yc}Q${CX} ${yt} ${CX + hw} ${yc}Q${CX} ${yb} ${CX - hw} ${yc}Z` };
}

/** Upper teeth: a band that hangs `h` below the upper lip (clipped to the mouth). */
function teethPath({ hw, yc, yt }: { hw: number; yc: number; yt: number }, h: number) {
  return `M${CX - hw} ${yc - 2}Q${CX} ${yt - 2} ${CX + hw} ${yc - 2}L${CX + hw} ${yc + h}Q${CX} ${yt + h} ${CX - hw} ${yc + h}Z`;
}

function dimples(hw: number, yc: number) {
  return `M${CX - hw - 4} ${yc - 4}q-3 4 0 8M${CX + hw + 4} ${yc - 4}q3 4 0 8`;
}

/** A wobbly ring around the disc; amplitude follows the voice. */
function auraPath(t: number, amp: number, phase: number) {
  const n = 72;
  let d = "";
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const w = Math.sin(3 * a + t * 2.1 + phase) * 0.5 + Math.sin(5 * a - t * 3.3 + phase * 2) * 0.3 + Math.sin(2 * a + t * 1.2) * 0.2;
    const r = R + 4 + amp * (0.6 + 0.4 * w);
    d += `${k ? "L" : "M"}${(120 + Math.cos(a) * r).toFixed(1)} ${(140 + Math.sin(a) * r).toFixed(1)}`;
  }
  return d + "Z";
}

type Pose = { smile: number; joy: number; grin: number };
function pose(mode: SpeechMode, mood: FaceMood): Pose {
  if (mood === "happy" && mode !== "listening") return { smile: 1, joy: 1, grin: 1 };
  if (mode === "speaking") return { smile: 0.55, joy: 0.3, grin: 0 };
  if (mode === "listening") return { smile: 0.7, joy: 0.2, grin: 0 };
  if (mode === "thinking") return { smile: 0.45, joy: 0, grin: 0 };
  return { smile: 0.85, joy: 0.3, grin: 0 };
}

export function TalkingFace({
  mode,
  levelRef,
  mood = "neutral",
  paused = false,
  className,
}: {
  mode: SpeechMode;
  levelRef: RefObject<number>;
  mood?: FaceMood;
  /** Stop the animation loop (e.g. this face is hidden behind the full view). */
  paused?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, ""); // ids must be unique when two faces are on screen
  const ids = { circle: `${uid}-c`, mouth: `${uid}-m`, eyes: `${uid}-e`, disc: `${uid}-d`, aura: `${uid}-a` };
  const modeRef = useRef(mode);
  const moodRef = useRef(mood);
  const head = useRef<SVGGElement>(null);
  const mouth = useRef<SVGPathElement>(null);
  const clip = useRef<SVGPathElement>(null);
  const teeth = useRef<SVGPathElement>(null);
  const tongue = useRef<SVGEllipseElement>(null);
  const dimple = useRef<SVGPathElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const lids = useRef<SVGGElement>(null);
  const lashes = useRef<SVGGElement>(null);
  const under = useRef<SVGGElement>(null);
  const brows = useRef<SVGGElement>(null);
  const cheeks = useRef<SVGGElement>(null);
  const auraA = useRef<SVGPathElement>(null);
  const auraB = useRef<SVGPathElement>(null);
  const ringA = useRef<SVGGElement>(null);
  const ringB = useRef<SVGGElement>(null);
  const sweep = useRef<SVGCircleElement>(null);

  useEffect(() => {
    modeRef.current = mode;
    moodRef.current = mood;
  }, [mode, mood]);

  useEffect(() => {
    if (reduce || paused) return;
    let raf = 0;
    let last = performance.now();
    let open = 0;
    let nextBlink = last + 1800;
    let blinkStart = -1;
    let gx = 0;
    let gy = 0;
    let gTx = 0;
    let gTy = 0;
    let nextGlance = 0;
    let lift = 0;
    let tilt = 0;
    let nod = 0;
    let amp = 2;
    let spinA = 0;
    let spinB = 0;
    const p = { ...pose(modeRef.current, moodRef.current) };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const m = modeRef.current;
      const t = now / 1000;
      const level = clamp(levelRef.current ?? 0);
      const target = pose(m, moodRef.current);
      p.smile += (target.smile - p.smile) * 0.1;
      p.joy += (target.joy - p.joy) * 0.1;
      p.grin += (target.grin - p.grin) * 0.1;

      // Mouth: follow loudness fast on the way up, slower on the way down; a grin parts the lips.
      const want = m === "speaking" ? clamp(level * 1.5) : p.grin * 0.14;
      open += (want - open) * (want > open ? 0.45 : 0.22);
      const round = m === "speaking" ? 0.5 + 0.5 * Math.sin(t * 8.3 + Math.sin(t * 3.1) * 2) : 0.3;
      const g = mouthGeo(open, round, p.smile);
      mouth.current?.setAttribute("d", g.d);
      clip.current?.setAttribute("d", g.d);
      mouth.current?.setAttribute("fill", open > 0.07 ? MOUTH_IN : LIPS);
      teeth.current?.setAttribute("d", teethPath(g, clamp(open * 14 + p.grin * 4, 0, 9)));
      tongue.current?.setAttribute("cy", String(CY + 8 + open * 26));
      tongue.current?.setAttribute("opacity", open > 0.25 ? "1" : "0");
      dimple.current?.setAttribute("d", dimples(g.hw, g.yc));
      dimple.current?.setAttribute("opacity", (p.smile * 0.55).toFixed(2));

      // Blink every few seconds (lid and lash line travel together).
      if (blinkStart < 0 && now > nextBlink) blinkStart = now;
      let lid = 0;
      if (blinkStart >= 0) {
        const q = (now - blinkStart) / 170;
        lid = q >= 1 ? 0 : Math.sin(q * Math.PI);
        if (q >= 1) {
          blinkStart = -1;
          nextBlink = now + 2200 + Math.random() * 3200;
        }
      }
      const lidY = `translate(0 ${(UPPER_LID + lid * 22).toFixed(2)})`;
      lids.current?.setAttribute("transform", lidY);
      lashes.current?.setAttribute("transform", lidY);
      // Smiling eyes: the lower lid rises with joy.
      under.current?.setAttribute("transform", `translate(0 ${lerp(6, -1, p.joy).toFixed(2)})`);
      cheeks.current?.setAttribute("opacity", (0.12 + p.joy * 0.12).toFixed(3));

      // Eyes: glance around when idle, look up-right while thinking, meet your gaze when listening.
      if (now > nextGlance) {
        gTx = m === "idle" ? (Math.random() - 0.5) * 6 : m === "thinking" ? 5 : (Math.random() - 0.5) * 2;
        gTy = m === "thinking" ? -4 : (Math.random() - 0.5) * 2.5;
        nextGlance = now + 900 + Math.random() * 1800;
      }
      gx += (gTx - gx) * 0.12;
      gy += (gTy - gy) * 0.12;
      eyes.current?.setAttribute("transform", `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`);

      // Brows rise when listening or happy, bounce a little with speech.
      const browTarget = m === "listening" ? -5 : m === "thinking" ? -2.5 : -open * 4 - p.grin * 2;
      lift += (browTarget - lift) * 0.15;
      brows.current?.setAttribute("transform", `translate(0 ${lift.toFixed(2)})`);

      // Head: always breathing; leans in while listening; nods with the voice; a happy tilt.
      const tiltTarget = m === "listening" ? 4 : m === "thinking" ? -4 : p.grin * 3 + Math.sin(t * 0.7) * 1.2;
      tilt += (tiltTarget - tilt) * 0.08;
      nod += ((m === "speaking" ? level * 5 : 0) - nod) * 0.2;
      const bob = Math.sin(t * 1.6) * 1.4;
      head.current?.setAttribute("transform", `translate(0 ${(bob + nod).toFixed(2)}) rotate(${tilt.toFixed(2)} ${CX} 250)`);

      // Aura swells with the voice; HUD rings turn, quickest while thinking.
      const live = m === "listening" || m === "speaking";
      const ampTarget = live ? 3 + level * 15 : m === "thinking" ? 5 : 2 + Math.sin(t * 1.4) * 0.8;
      amp += (ampTarget - amp) * 0.18;
      auraA.current?.setAttribute("d", auraPath(t, amp, 0));
      auraB.current?.setAttribute("d", auraPath(t * 0.8, amp * 0.85, 2.4));
      const speed = m === "thinking" ? 140 : live ? 26 + level * 60 : 8;
      spinA += speed * dt;
      spinB -= speed * 0.6 * dt;
      ringA.current?.setAttribute("transform", `rotate(${(spinA % 360).toFixed(1)} 120 140)`);
      ringB.current?.setAttribute("transform", `rotate(${(spinB % 360).toFixed(1)} 120 140)`);
      sweep.current?.setAttribute("opacity", m === "thinking" ? "0.95" : "0");

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce, paused, levelRef]);

  // Rest pose, used for the first paint and as the still face under reduced motion.
  const rest = pose(mode, mood);
  const g0 = mouthGeo(rest.grin * 0.14, 0.3, rest.smile);

  return (
    <div className={cn("relative grid place-items-center", className)} role="img" aria-label={`Taskora is ${mode}`}>
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
          <clipPath id={ids.circle}>
            <circle cx="120" cy="140" r={R} />
          </clipPath>
          <clipPath id={ids.mouth}>
            <path ref={clip} d={g0.d} />
          </clipPath>
          <clipPath id={ids.eyes}>
            <ellipse cx="92" cy="138" rx="14" ry="10.5" />
            <ellipse cx="148" cy="138" rx="14" ry="10.5" />
          </clipPath>
          <radialGradient id={ids.disc} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#fce7b2" />
            <stop offset="70%" stopColor="#f3d488" />
            <stop offset="100%" stopColor="#f2b33d" />
          </radialGradient>
          <linearGradient id={ids.aura} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f2b33d" />
            <stop offset="55%" stopColor="#e8622a" />
            <stop offset="100%" stopColor="#b23a48" />
          </linearGradient>
        </defs>

        {/* aura + HUD rings (no SVG blur on the aura: it would re-rasterise every frame) */}
        <path ref={auraB} d={auraPath(0, 2, 2.4)} fill="#7dbe8f" opacity="0.45" />
        <path ref={auraA} d={auraPath(0, 2, 0)} fill={`url(#${ids.aura})`} opacity="0.6" />
        <g ref={ringA} fill="none">
          <circle cx="120" cy="140" r="127" stroke="#f2b33d" strokeWidth="1.6" strokeDasharray="2 7" opacity="0.7" />
          <circle cx="120" cy="140" r="127" stroke="#fce7b2" strokeWidth="3" strokeDasharray="60 739" strokeLinecap="round" opacity="0.8" />
        </g>
        <g ref={ringB} fill="none">
          <circle cx="120" cy="140" r="134" stroke="#7dbe8f" strokeWidth="1.2" strokeDasharray="24 18 4 18" opacity="0.55" />
          <circle ref={sweep} cx="120" cy="140" r="134" stroke="#f2b33d" strokeWidth="3.5" strokeDasharray="90 752" strokeLinecap="round" opacity="0" />
        </g>

        <circle cx="120" cy="140" r={R} fill={`url(#${ids.disc})`} />
        <g clipPath={`url(#${ids.circle})`}>
          {/* the whole person is drawn at 86% so the jacket shows under the face */}
          <g transform="translate(16.8 17.92) scale(0.86)">
            {/* haldi kurta, mandarin collar, neem Nehru jacket with haldi piping and a saffron pocket square */}
            <path d="M-20 300V262C-20 236 34 226 78 222L120 244L162 222C206 226 260 236 260 262V300Z" fill="#f3d488" />
            <path d="M-20 300V264C-20 238 30 228 72 223L120 290L168 223C210 228 260 238 260 264V300Z" fill="#24543f" />
            <path d="M72 223L120 290L168 223" fill="none" stroke="#f2b33d" strokeWidth="3" strokeLinejoin="round" />
            <path d="M184 252H210" stroke="#f2b33d" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M188 252L196 240L200 252Z" fill="#e8622a" />
            <g ref={head}>
              {/* neck + collar band */}
              <path d="M98 200H142V234C142 244 98 244 98 234Z" fill={SKIN_SHADE} />
              <path d="M94 228Q120 246 146 228L150 238Q120 258 90 238Z" fill="#f2b33d" />
              {/* ears */}
              <ellipse cx="53" cy="148" rx="9" ry="15" fill={SKIN_SHADE} />
              <ellipse cx="187" cy="148" rx="9" ry="15" fill={SKIN_SHADE} />
              {/* hair behind the head */}
              <path d="M52 140C42 70 82 30 120 30C158 30 198 70 188 140C176 100 160 84 120 84C80 84 64 100 52 140Z" fill={HAIR} />
              {/* head */}
              <path d="M58 128C58 76 88 52 120 52C152 52 182 76 182 128C182 178 156 222 120 222C84 222 58 178 58 128Z" fill={SKIN} />
              {/* jaw shade */}
              <path d="M160 176C152 202 138 216 120 220C142 222 166 196 172 160Z" fill={SKIN_SHADE} opacity="0.35" />
              {/* side-parted hair */}
              <path d="M56 122C52 74 82 40 122 40C162 40 190 72 184 124C180 104 172 90 158 82C140 92 112 96 88 92C74 98 62 108 56 122Z" fill={HAIR} />
              <path d="M100 44Q86 64 86 92" fill="none" stroke="#5a3a26" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
              {/* cheeks */}
              <g ref={cheeks} opacity={0.12 + rest.joy * 0.12}>
                <circle cx="80" cy="172" r="12" fill="#e8622a" />
                <circle cx="160" cy="172" r="12" fill="#e8622a" />
              </g>
              {/* brows */}
              <g ref={brows} fill="none" stroke={HAIR} strokeWidth="6" strokeLinecap="round">
                <path d="M78 116Q93 108 107 113" />
                <path d="M133 113Q147 108 162 116" />
              </g>
              {/* eyes: everything inside is clipped to the eye shapes */}
              <g clipPath={`url(#${ids.eyes})`}>
                <rect x="70" y="120" width="100" height="36" fill="#fce7b2" />
                <g ref={eyes}>
                  <circle cx="92" cy="138" r="7.5" fill={HAIR} />
                  <circle cx="148" cy="138" r="7.5" fill={HAIR} />
                  <circle cx="92" cy="138" r="3.6" fill="#1f130b" />
                  <circle cx="148" cy="138" r="3.6" fill="#1f130b" />
                  <circle cx="94.6" cy="135.2" r="2.2" fill="#fce7b2" />
                  <circle cx="150.6" cy="135.2" r="2.2" fill="#fce7b2" />
                </g>
                <g ref={under} transform={`translate(0 ${lerp(6, -1, rest.joy)})`} fill={SKIN}>
                  <path d="M74 158Q92 134 110 158Z" />
                  <path d="M130 158Q148 134 166 158Z" />
                </g>
                <g ref={lids} transform={`translate(0 ${UPPER_LID})`} fill={SKIN}>
                  <rect x="74" y="100" width="36" height="28" />
                  <rect x="130" y="100" width="36" height="28" />
                </g>
              </g>
              <g ref={lashes} transform={`translate(0 ${UPPER_LID})`} fill="none" stroke={HAIR} strokeWidth="3.2" strokeLinecap="round">
                <path d="M77 131Q92 122 107 130" />
                <path d="M133 130Q148 122 163 131" />
              </g>
              {/* nose */}
              <path d="M117 144Q113 160 110 167Q114 172 120 171Q126 172 130 167" fill="none" stroke={SKIN_SHADE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {/* mouth */}
              <path ref={dimple} d={dimples(g0.hw, g0.yc)} fill="none" stroke={SKIN_SHADE} strokeWidth="2.4" strokeLinecap="round" opacity={rest.smile * 0.55} />
              <path ref={mouth} d={g0.d} fill={LIPS} stroke={LIPS} strokeWidth="2" strokeLinejoin="round" />
              <g clipPath={`url(#${ids.mouth})`}>
                <path ref={teeth} d={teethPath(g0, rest.grin * 4)} fill="#fce7b2" />
                <ellipse ref={tongue} cx="120" cy={CY + 8} rx="14" ry="8" fill={LIPS} opacity="0" />
              </g>
            </g>
          </g>
        </g>
        <circle cx="120" cy="140" r={R} fill="none" stroke="#f2b33d" strokeWidth="2.5" opacity="0.9" />
      </svg>
    </div>
  );
}
