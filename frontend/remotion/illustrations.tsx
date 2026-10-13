import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./palette";

/*
 * Flat, cut-out style illustrations drawn in SVG so every limb can be animated per frame.
 * Everything here renders inside an <svg> whose user units are video pixels.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const ease = Easing.bezier(0.7, 0, 0.2, 1);

/** Shoulder angle `a` and elbow bend `e`, in degrees. Positive = outward/up, 0 = hanging down. */
export type Arm = { a: number; e: number };

export type PersonProps = {
  /** Feet position and scale (1 = 462px tall). */
  x: number;
  y: number;
  s: number;
  skin: string;
  hair?: string;
  hairStyle: "short" | "long" | "bun" | "curly";
  shirt: string;
  pants: string;
  /** Viewer's left / right arm. */
  left?: Arm;
  right?: Arm;
  /** -1..1, where the eyes and head lean. */
  look?: number;
  /** 0..1 mouth open; drives talking. */
  talk?: number;
  mood?: "smile" | "worried" | "grin";
  seed?: number;
  glasses?: boolean;
  lanyard?: boolean;
  phone?: "left" | "right";
  /** Vertical bounce (px, unscaled), e.g. while walking. */
  bob?: number;
};

const ArmShape: React.FC<{
  side: "left" | "right";
  arm: Arm;
  shirt: string;
  skin: string;
  phone?: boolean;
}> = ({ side, arm, shirt, skin, phone }) => {
  // SVG rotation is clockwise, so the viewer's right arm turns negative to swing outward.
  const sign = side === "right" ? -1 : 1;
  return (
    <g transform={`translate(${side === "right" ? 54 : -54} -320) rotate(${sign * arm.a})`}>
      <line x1={0} y1={0} x2={0} y2={84} stroke={shirt} strokeWidth={32} strokeLinecap="round" />
      <g transform={`translate(0 84) rotate(${sign * arm.e})`}>
        <line x1={0} y1={0} x2={0} y2={70} stroke={skin} strokeWidth={22} strokeLinecap="round" />
        <circle cx={0} cy={78} r={15} fill={skin} />
        {phone && (
          <g>
            <rect x={-15} y={66} width={30} height={52} rx={7} fill={C.neem} />
            <rect x={-10} y={72} width={20} height={36} rx={4} fill={C.tulsi} />
          </g>
        )}
      </g>
    </g>
  );
};

export const Person: React.FC<PersonProps> = ({
  x,
  y,
  s,
  skin,
  hair = C.hair,
  hairStyle,
  shirt,
  pants,
  left = { a: 8, e: 4 },
  right = { a: 8, e: 4 },
  look = 0,
  talk = 0,
  mood = "smile",
  seed = 0,
  glasses,
  lanyard,
  phone,
  bob = 0,
}) => {
  const frame = useCurrentFrame();
  const breathe = 1 + 0.012 * Math.sin((frame + seed * 13) / 11);
  const blink = (frame + seed * 37) % 97 < 4 ? 0.15 : 1;
  const tilt = look * 5 + Math.sin((frame + seed * 21) / 23) * 1.5;
  const eyeX = look * 5;
  const ink = C.neemDeep;

  return (
    <g transform={`translate(${x} ${y + bob * s}) scale(${s})`}>
      {/* ground shadow */}
      <ellipse cx={0} cy={0} rx={86} ry={13} fill={C.neem} opacity={0.18} />
      {/* legs + shoes */}
      <rect x={-40} y={-196} width={36} height={186} rx={15} fill={pants} />
      <rect x={4} y={-196} width={36} height={186} rx={15} fill={pants} />
      <ellipse cx={-28} cy={-9} rx={28} ry={13} fill={C.shoe} />
      <ellipse cx={28} cy={-9} rx={28} ry={13} fill={C.shoe} />

      {/* long hair sits behind everything above the shoulders */}
      {hairStyle === "long" && (
        <g transform={`rotate(${tilt} 0 -355)`}>
          <rect x={-56} y={-446} width={112} height={128} rx={48} fill={hair} />
        </g>
      )}

      {/* torso */}
      <g transform={`translate(0 -186) scale(1 ${breathe}) translate(0 186)`}>
        <rect x={-14} y={-364} width={28} height={34} rx={8} fill={skin} />
        <path
          d="M -62 -300 Q -64 -338 -30 -340 L 30 -340 Q 64 -338 62 -300 L 52 -184 Q 0 -176 -52 -184 Z"
          fill={shirt}
        />
        <path d="M -16 -340 L 0 -318 L 16 -340" fill="none" stroke={ink} strokeOpacity={0.25} strokeWidth={4} />
        {lanyard && (
          <g>
            <path d="M -24 -338 L 0 -276 L 24 -338" fill="none" stroke={C.kumkum} strokeWidth={5} />
            <rect x={-16} y={-280} width={32} height={40} rx={5} fill={C.paper} stroke={C.neem} strokeWidth={3} />
            <rect x={-9} y={-270} width={18} height={6} rx={3} fill={C.saffron} />
          </g>
        )}
      </g>

      {/* head */}
      <g transform={`rotate(${tilt} 0 -355)`}>
        {hairStyle === "bun" && <circle cx={0} cy={-458} r={23} fill={hair} />}
        {hairStyle === "curly" &&
          [-38, -19, 0, 19, 38].map((cx, i) => <circle key={cx} cx={cx} cy={-440 - (i % 2) * 6} r={20} fill={hair} />)}
        <circle cx={-46} cy={-398} r={9} fill={skin} />
        <circle cx={46} cy={-398} r={9} fill={skin} />
        <circle cx={0} cy={-400} r={46} fill={skin} />
        <path
          d="M -50 -394 C -55 -452 -20 -462 4 -460 C 38 -458 58 -440 50 -390 C 42 -418 22 -426 0 -424 C -22 -426 -40 -416 -50 -394 Z"
          fill={hair}
        />
        {/* face */}
        <ellipse cx={-16 + eyeX} cy={-400} rx={5} ry={6.5 * blink} fill={ink} />
        <ellipse cx={16 + eyeX} cy={-400} rx={5} ry={6.5 * blink} fill={ink} />
        {mood === "worried" && (
          <g stroke={ink} strokeWidth={4} strokeLinecap="round">
            <line x1={-24 + eyeX} y1={-418} x2={-9 + eyeX} y2={-414} />
            <line x1={24 + eyeX} y1={-418} x2={9 + eyeX} y2={-414} />
          </g>
        )}
        {glasses && (
          <g fill="none" stroke={ink} strokeWidth={3.5}>
            <circle cx={-16 + eyeX} cy={-400} r={13} />
            <circle cx={16 + eyeX} cy={-400} r={13} />
            <line x1={-3 + eyeX} y1={-401} x2={3 + eyeX} y2={-401} />
          </g>
        )}
        <circle cx={-27 + eyeX} cy={-383} r={7} fill={C.kumkum} opacity={0.22} />
        <circle cx={27 + eyeX} cy={-383} r={7} fill={C.kumkum} opacity={0.22} />
        <path
          d={`M ${-1 + eyeX} -394 Q ${5 + eyeX} -386 ${-1 + eyeX} -384`}
          fill="none"
          stroke={ink}
          strokeOpacity={0.3}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {talk > 0.05 ? (
          <ellipse cx={eyeX * 0.6} cy={-372} rx={10} ry={2 + 9 * talk} fill={C.mouth} />
        ) : mood === "grin" ? (
          <path d={`M ${-17 + eyeX} -378 Q ${eyeX} -354 ${17 + eyeX} -378 Z`} fill={C.mouth} />
        ) : mood === "worried" ? (
          <path
            d={`M ${-11 + eyeX} -369 Q ${eyeX} -377 ${11 + eyeX} -369`}
            fill="none"
            stroke={ink}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M ${-13 + eyeX} -377 Q ${eyeX} -365 ${13 + eyeX} -377`}
            fill="none"
            stroke={ink}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}
      </g>

      {/* arms in front of the torso */}
      <ArmShape side="left" arm={left} shirt={shirt} skin={skin} phone={phone === "left"} />
      <ArmShape side="right" arm={right} shirt={shirt} skin={skin} phone={phone === "right"} />
    </g>
  );
};

/** Mouth movement that looks like speech while `on`. */
export const talkAt = (frame: number, from: number, to: number) =>
  frame >= from && frame < to ? 0.25 + 0.75 * Math.abs(Math.sin(frame / 2.3) * Math.cos(frame / 5.1)) : 0;

/* ───────────────────────── Office backdrop ───────────────────────── */

type BackdropProps = {
  drift?: number;
  /** "dusk" is the dark neem office used behind the board. */
  tone?: "day" | "dusk";
  lamps?: boolean;
  clock?: boolean;
  plant?: boolean;
};

export const OfficeBackdrop: React.FC<BackdropProps> = ({
  drift = 1,
  tone = "day",
  lamps: showLamps = true,
  clock: showClock = true,
  plant: showPlant = true,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const vertical = H > W;
  const dusk = tone === "dusk";
  const P = dusk
    ? {
        wall: C.neem,
        stripe: C.neemDeep,
        skirting: C.neemDeep,
        floor: C.neemDeep,
        floorLine: C.neem,
        skyTop: C.saffron,
        skyLow: C.kumkum,
        sun: C.haldi,
        frame: C.neemDeep,
        bldA: C.neemDeep,
        bldB: C.neemSoft,
        lit: 0.35,
      }
    : {
        wall: C.wall,
        stripe: C.paperDeep,
        skirting: C.neemSoft,
        floor: C.floor,
        floorLine: C.floorLine,
        skyTop: C.skyTop,
        skyLow: C.skyLow,
        sun: C.paper,
        frame: C.neem,
        bldA: C.moss,
        bldB: C.neemSoft,
        lit: 0.55,
      };
  const floorY = H * (vertical ? 0.84 : 0.8);
  const camX = Math.sin(frame / 90) * 10 * drift;

  const wins = vertical
    ? [
        { x: W * 0.07, y: H * 0.42, w: W * 0.4, h: H * 0.25 },
        { x: W * 0.53, y: H * 0.42, w: W * 0.4, h: H * 0.25 },
      ]
    : [
        { x: W * 0.45, y: H * 0.1, w: W * 0.21, h: H * 0.5 },
        { x: W * 0.74, y: H * 0.1, w: W * 0.21, h: H * 0.5 },
      ];
  const skyX0 = wins[0].x;
  const skyX1 = wins[wins.length - 1].x + wins[wins.length - 1].w;
  const skyY0 = wins[0].y;
  const skyY1 = wins[0].y + wins[0].h;

  const buildings = Array.from({ length: 16 }).map((_, i) => {
    const bw = (skyX1 - skyX0) / 14;
    const bh = (0.25 + random(`b${i}`) * 0.5) * (skyY1 - skyY0);
    return { x: skyX0 - bw + i * bw * 1.02, w: bw * (0.75 + random(`w${i}`) * 0.3), h: bh };
  });
  const clock = vertical ? { x: W * 0.5, y: H * 0.385, r: 34 } : { x: W * 0.695, y: H * 0.2, r: 44 };
  const lamps = vertical ? [W * 0.8] : [W * 0.555, W * 0.845];
  const plant = vertical ? { x: W * 0.9 } : { x: W * 0.39 };

  return (
    <g transform={`translate(${camX} 0)`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.skyTop} />
          <stop offset="1" stopColor={P.skyLow} />
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stopColor={C.haldi} stopOpacity={0.55} />
          <stop offset="1" stopColor={C.haldi} stopOpacity={0} />
        </radialGradient>
        <clipPath id="panes">
          {wins.map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} />
          ))}
        </clipPath>
      </defs>

      {/* wall + floor */}
      <rect x={-40} y={0} width={W + 80} height={floorY} fill={P.wall} />
      {Array.from({ length: 24 }).map((_, i) => (
        <rect key={i} x={-40 + i * 90} y={0} width={4} height={floorY} fill={P.stripe} opacity={0.7} />
      ))}
      <rect x={-40} y={floorY - 22} width={W + 80} height={22} fill={P.skirting} />
      <rect x={-40} y={floorY} width={W + 80} height={H - floorY} fill={P.floor} />
      {Array.from({ length: 5 }).map((_, i) => (
        <line
          key={i}
          x1={-40}
          x2={W + 40}
          y1={floorY + ((i + 1) * (H - floorY)) / 6}
          y2={floorY + ((i + 1) * (H - floorY)) / 6}
          stroke={P.floorLine}
          strokeWidth={4}
        />
      ))}

      {/* sunset city through the windows */}
      <g clipPath="url(#panes)">
        <rect x={skyX0} y={skyY0} width={skyX1 - skyX0} height={skyY1 - skyY0} fill="url(#sky)" />
        <circle
          cx={skyX0 + (skyX1 - skyX0) * 0.62}
          cy={skyY0 + (skyY1 - skyY0) * (0.58 - frame * 0.00012)}
          r={(skyY1 - skyY0) * 0.2}
          fill={P.sun}
          opacity={0.9}
        />
        {[0, 1, 2].map((i) => {
          const cx = skyX0 + (((i * 0.37 + frame * 0.0009) % 1.2) - 0.1) * (skyX1 - skyX0);
          const cy = skyY0 + (skyY1 - skyY0) * (0.18 + i * 0.12);
          return (
            <g key={i} fill={C.paper} opacity={dusk ? 0.3 : 0.75}>
              <ellipse cx={cx} cy={cy} rx={70} ry={20} />
              <ellipse cx={cx + 30} cy={cy - 14} rx={40} ry={20} />
            </g>
          );
        })}
        {buildings.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={skyY1 - b.h} width={b.w} height={b.h} fill={i % 3 === 0 ? P.bldB : P.bldA} />
            {Array.from({ length: Math.floor(b.h / 34) }).map((_, j) =>
              random(`l${i}-${j}`) > P.lit ? (
                <rect
                  key={j}
                  x={b.x + b.w * 0.3}
                  y={skyY1 - b.h + 14 + j * 34}
                  width={b.w * 0.4}
                  height={12}
                  fill={C.haldi}
                  opacity={0.85}
                />
              ) : null,
            )}
          </g>
        ))}
      </g>
      {wins.map((w, i) => (
        <g key={i} fill="none" stroke={P.frame}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} strokeWidth={14} rx={6} />
          <line x1={w.x + w.w / 2} x2={w.x + w.w / 2} y1={w.y} y2={w.y + w.h} strokeWidth={8} />
          <line x1={w.x} x2={w.x + w.w} y1={w.y + w.h * 0.55} y2={w.y + w.h * 0.55} strokeWidth={8} />
          <rect x={w.x - 18} y={w.y + w.h + 6} width={w.w + 36} height={16} rx={6} fill={P.frame} stroke="none" />
        </g>
      ))}

      {/* wall clock — hands race to say "time is slipping" */}
      {showClock && (
      <g transform={`translate(${clock.x} ${clock.y})`}>
        <circle r={clock.r} fill={C.paper} stroke={C.neem} strokeWidth={8} />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-clock.r * 0.55}
          stroke={C.neem}
          strokeWidth={6}
          strokeLinecap="round"
          transform={`rotate(${frame * 1.5})`}
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-clock.r * 0.75}
          stroke={C.saffron}
          strokeWidth={4}
          strokeLinecap="round"
          transform={`rotate(${frame * 18})`}
        />
        <circle r={5} fill={C.neem} />
      </g>
      )}

      {/* pendant lamps */}
      {showLamps &&
        lamps.map((lx, i) => {
        const len = vertical ? H * 0.07 : H * 0.15;
        return (
          <g key={i} transform={`rotate(${Math.sin((frame + i * 40) / 32) * 2.5} ${lx} 0)`}>
            <ellipse cx={lx} cy={len + 70} rx={170} ry={90} fill="url(#lampGlow)" />
            <line x1={lx} x2={lx} y1={0} y2={len} stroke={dusk ? C.neemDeep : C.neem} strokeWidth={5} />
            <path d={`M ${lx - 24} ${len} L ${lx + 24} ${len} L ${lx + 62} ${len + 54} L ${lx - 62} ${len + 54} Z`} fill={C.saffron} />
            <ellipse cx={lx} cy={len + 56} rx={24} ry={9} fill={C.paper} />
          </g>
        );
      })}

      {/* potted plant */}
      {showPlant && (
      <g transform={`translate(${plant.x} ${floorY + 8})`}>
        {[-55, -30, -8, 14, 36, 58].map((r, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={-150}
            rx={22}
            ry={78}
            fill={i % 2 ? C.tulsi : C.neemSoft}
            transform={`rotate(${r + Math.sin((frame + i * 9) / 18) * 3} 0 -80)`}
          />
        ))}
        <path d="M -52 -86 L 52 -86 L 40 0 L -40 0 Z" fill={C.kumkum} />
        <rect x={-58} y={-98} width={116} height={18} rx={6} fill={C.kumkum} />
      </g>
      )}
    </g>
  );
};

/** A desk that hides the legs of whoever stands behind it. */
export const Desk: React.FC<{ x1: number; x2: number; top: number; bottom: number }> = ({ x1, x2, top, bottom }) => {
  const w = x2 - x1;
  const h = bottom - top;
  return (
    <g>
      {/* legs, a modesty panel, then the top */}
      <rect x={x1 + 40} y={top} width={26} height={h} rx={8} fill={C.neem} />
      <rect x={x2 - 66} y={top} width={26} height={h} rx={8} fill={C.neem} />
      <rect x={x1 + 40} y={top + 10} width={w - 80} height={h * 0.45} rx={10} fill={C.moss} />
      <rect x={x1} y={top - 6} width={w} height={28} rx={10} fill={C.neemSoft} />
      {/* laptops, backs to the camera */}
      {[0.22, 0.7].map((f) => (
        <g key={f} transform={`translate(${x1 + w * f} ${top - 6})`}>
          <path d="M -66 0 L 66 0 L 58 -84 L -58 -84 Z" fill={C.moss} />
          <circle cx={0} cy={-44} r={11} fill={C.haldi} />
        </g>
      ))}
      <g transform={`translate(${x1 + w * 0.46} ${top - 6})`}>
        <rect x={-20} y={-46} width={40} height={46} rx={8} fill={C.saffron} />
        <path d="M 20 -34 q 18 0 18 13 q 0 13 -18 13" fill="none" stroke={C.saffron} strokeWidth={8} />
      </g>
    </g>
  );
};

/* ───────────────────────── Props ───────────────────────── */

/** A "?" sticker that pops and wobbles. */
export const Question: React.FC<{ x: number; y: number; delay: number; size?: number; fontFamily: string }> = ({
  x,
  y,
  delay,
  size = 90,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 8, stiffness: 170 } });
  const wob = Math.sin((frame - delay) / 6) * 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${p}) rotate(${wob})`}>
      <circle r={size * 0.62} fill={C.paper} stroke={C.neem} strokeWidth={6} />
      <text
        y={size * 0.33}
        textAnchor="middle"
        fontFamily={fontFamily}
        fontWeight={800}
        fontSize={size}
        fill={C.kumkum}
      >
        ?
      </text>
    </g>
  );
};

/** Paper confetti in the palette. */
export const Confetti: React.FC<{ delay: number; count?: number }> = ({ delay, count = 90 }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const colors = [C.saffron, C.haldi, C.tulsi, C.kumkum, C.paper, C.neemSoft];
  const t = frame - delay;
  if (t < 0) return null;
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const x0 = random(`cx${i}`) * W;
        const start = random(`cs${i}`) * 30;
        const speed = H * (0.007 + random(`cv${i}`) * 0.008);
        const lt = t - start;
        if (lt < 0) return null;
        const yy = -40 + lt * speed;
        const xx = x0 + Math.sin(lt / 9 + i) * 40;
        const rot = lt * (4 + random(`cr${i}`) * 8) * (i % 2 ? 1 : -1);
        const w = 14 + random(`cw${i}`) * 14;
        return (
          <rect
            key={i}
            x={-w / 2}
            y={-w * 0.3}
            width={w}
            height={w * 0.6}
            rx={3}
            fill={colors[i % colors.length]}
            transform={`translate(${xx} ${yy}) rotate(${rot}) scale(1 ${Math.cos(lt / 5 + i)})`}
          />
        );
      })}
    </g>
  );
};

/** Bullseye with an arrow that flies in and thunks into the centre at `hit`. */
export const Bullseye: React.FC<{ x: number; y: number; r: number; hit: number }> = ({ x, y, r, hit }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const inP = spring({ frame: frame - (hit - 30), fps, config: { damping: 12, stiffness: 120 } });
  const fly = ease(clamp01((frame - (hit - 14)) / 14));
  const after = Math.max(0, frame - hit);
  const wob = frame >= hit ? Math.sin(after * 1.6) * 9 * Math.exp(-after / 9) : 0;
  const ring = frame >= hit ? clamp01(after / 22) : 0;
  const arrowLen = r * 1.5;
  const ax = interpolate(fly, [0, 1], [-width * 0.9, 0]);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`scale(${inP})`}>
        {frame >= hit && (
          <circle r={r * (1 + ring * 0.7)} fill="none" stroke={C.haldi} strokeWidth={10 * (1 - ring)} opacity={1 - ring} />
        )}
        <circle r={r} fill={C.kumkum} stroke={C.neem} strokeWidth={8} />
        <circle r={r * 0.74} fill={C.paper} />
        <circle r={r * 0.5} fill={C.kumkum} />
        <circle r={r * 0.26} fill={C.haldi} />
      </g>
      {frame >= hit - 14 && (
        <g transform={`translate(${ax} 0) rotate(${-14 + wob})`}>
          <line x1={-arrowLen} y1={0} x2={-8} y2={0} stroke={C.neem} strokeWidth={10} strokeLinecap="round" />
          <path d={`M 0 0 L -30 -16 L -30 16 Z`} fill={C.neem} />
          <path d={`M ${-arrowLen} 0 l -26 -22 l 26 0 z M ${-arrowLen} 0 l -26 22 l 26 0 z`} fill={C.saffron} />
          <path d={`M ${-arrowLen + 30} 0 l -26 -22 l 26 0 z M ${-arrowLen + 30} 0 l -26 22 l 26 0 z`} fill={C.saffron} />
        </g>
      )}
    </g>
  );
};
