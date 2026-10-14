import React from "react";
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Img,
  staticFile,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadAnek } from "@remotion/google-fonts/AnekTelugu";
import { loadFont as loadMukta } from "@remotion/google-fonts/Mukta";
import { C, SKIN } from "./palette";
import {
  Bullseye,
  Confetti,
  Desk,
  OfficeBackdrop,
  Person,
  Question,
  ease,
  talkAt,
  type Arm,
} from "./illustrations";
import voiceover from "./voiceover.json";

const anek = loadAnek("normal", { weights: ["800"], subsets: ["latin"] });
const mukta = loadMukta("normal", { weights: ["600", "700"], subsets: ["latin"] });

export const FPS = 30;

/** Scene start frames. Each scene holds about five seconds so the copy can be read. */
const AT = { stale: 0, speak: 150, board: 300, win: 450, brand: 615 };
export const DURATION = 750;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpArm = (from: Arm, to: Arm, t: number): Arm => ({ a: lerp(from.a, to.a, t), e: lerp(from.e, to.e, t) });
const REST: Arm = { a: 8, e: 4 };
const SHRUG: Arm = { a: 22, e: 78 };

function useLayout() {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height > width };
}

/** Headline padding: portrait phones crop about 9% of each side. */
const pad = (vertical: boolean, landscapeTop = "10%") => (vertical ? "23% 9% 0" : `${landscapeTop} 0 0 9%`);

/** A line of display type that slams up out of a mask. */
const Word: React.FC<{
  text: string;
  delay: number;
  size: number;
  color: string;
  bg?: string;
  rotate?: number;
}> = ({ text, delay, size, color, bg, rotate = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  const barP = clamp01((frame - delay - 4) / 10);
  return (
    <div style={{ overflow: "hidden", padding: `${size * 0.04}px ${size * 0.06}px`, lineHeight: 0.92 }}>
      <div
        style={{
          position: "relative",
          display: "inline-block",
          transform: `translateY(${(1 - p) * 115}%) rotate(${rotate * p}deg)`,
          fontFamily: anek.fontFamily,
          fontWeight: 800,
          fontSize: size,
          color,
          letterSpacing: "-0.02em",
          padding: bg ? `0 ${size * 0.12}px` : 0,
        }}
      >
        {bg && (
          <span
            style={{
              position: "absolute",
              inset: `${size * 0.06}px 0 ${size * 0.02}px 0`,
              background: bg,
              transformOrigin: "left center",
              transform: `scaleX(${ease(barP)})`,
              zIndex: -1,
              borderRadius: size * 0.06,
            }}
          />
        )}
        {text}
      </div>
    </div>
  );
};

/** Paper-grain overlay so flat colour feels printed, not digital. */
const Grain: React.FC = () => (
  <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: 0.22, pointerEvents: "none" }}>
    <svg width="100%" height="100%">
      <filter id="g">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
        <feColorMatrix values="0 0 0 0 0.09  0 0 0 0 0.25  0 0 0 0 0.19  0 0 0 0.9 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#g)" />
    </svg>
  </AbsoluteFill>
);

/**
 * Five colour strips that sweep in, then out. `at` is the frame it fully covers.
 * `stay` keeps it covering (used for the final frame the page fades over).
 */
const Wipe: React.FC<{ at: number; color: string; stay?: boolean }> = ({ at, color, stay }) => {
  const frame = useCurrentFrame();
  const strips = 5;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", flexDirection: "row" }}>
      {Array.from({ length: strips }).map((_, i) => {
        const entering = frame < at || stay;
        const t = entering
          ? ease(clamp01((frame - (at - 18) - i * 2) / 10))
          : 1 - ease(clamp01((frame - at - i * 2) / 12));
        return (
          <div
            key={i}
            style={{
              flex: 1,
              marginRight: -1,
              background: color,
              transformOrigin: entering ? "top" : "bottom",
              transform: `scaleY(${t})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Task card — the recurring object of the whole piece. */
const TaskCard: React.FC<{
  title: string;
  tag?: string;
  tagColor?: string;
  done?: boolean;
  width: number;
  tone?: "paper" | "neem";
  style?: React.CSSProperties;
}> = ({ title, tag, tagColor = C.saffron, done, width, tone = "paper", style }) => {
  const ink = tone === "paper" ? C.neem : C.paper;
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        padding: width * 0.075,
        borderRadius: width * 0.08,
        background: tone === "paper" ? C.paper : C.neemSoft,
        border: `${Math.max(3, width * 0.014)}px solid ${tone === "paper" ? C.neem : C.tulsi}`,
        boxShadow: `${width * 0.03}px ${width * 0.03}px 0 ${tone === "paper" ? C.neem : C.neemDeep}`,
        fontFamily: mukta.fontFamily,
        color: ink,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: width * 0.05 }}>
        <div
          style={{
            width: width * 0.1,
            height: width * 0.1,
            flexShrink: 0,
            borderRadius: width * 0.03,
            border: `${Math.max(3, width * 0.014)}px solid ${ink}`,
            background: done ? C.tulsi : "transparent",
            display: "grid",
            placeItems: "center",
            fontSize: width * 0.075,
            fontWeight: 700,
            color: C.neem,
          }}
        >
          {done ? "✓" : ""}
        </div>
        <div
          style={{
            fontSize: width * 0.1,
            fontWeight: 700,
            textDecoration: done ? "line-through" : "none",
            textDecorationThickness: width * 0.012,
            opacity: done ? 0.7 : 1,
          }}
        >
          {title}
        </div>
      </div>
      {tag && (
        <div
          style={{
            marginTop: width * 0.06,
            display: "inline-block",
            padding: `${width * 0.015}px ${width * 0.05}px`,
            borderRadius: 999,
            background: tagColor,
            color: tagColor === C.haldi || tagColor === C.tulsi ? C.neem : C.paper,
            fontSize: width * 0.065,
            fontWeight: 700,
          }}
        >
          {tag}
        </div>
      )}
    </div>
  );
};

/** Full-frame SVG layer whose units are video pixels. */
const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 1 — status goes stale ───────────────────────── */

const SceneStale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width: W, height: H } = useLayout();
  const size = vertical ? 190 : 200;
  const floorY = H * (vertical ? 0.84 : 0.8);
  const s = vertical ? 1.3 : 1.25;
  const feet = floorY + 30;
  const ax = vertical ? W * 0.3 : W * 0.6;
  const bx = vertical ? W * 0.72 : W * 0.86;
  const shrugA = spring({ frame: frame - 62, fps, config: { damping: 12, stiffness: 120 } });
  const shrugB = spring({ frame: frame - 98, fps, config: { damping: 12, stiffness: 120 } });

  // A tidy pinned row of stale cards above the two confused teammates.
  const cardW = vertical ? 270 : 290;
  const rowX = vertical ? [0.09, 0.37, 0.64] : [0.455, 0.625, 0.795];
  const rowY = vertical ? [0.445, 0.465, 0.445] : [0.135, 0.16, 0.135];
  const cards = [
    { t: "Login page", tag: "3 days ago", r: -3, d: 30 },
    { t: "Weekly report", tag: "Overdue", r: 2.5, d: 40 },
    { t: "API testing", tag: "No update", r: -2, d: 50 },
  ].map((c, i) => ({ ...c, x: W * rowX[i], y: H * rowY[i] }));

  return (
    <AbsoluteFill style={{ background: C.wall }}>
      <Stage>
        <OfficeBackdrop lamps={vertical} clock={vertical} />
        <Person
          x={ax}
          y={feet}
          s={s}
          skin={SKIN[0]}
          hairStyle="short"
          shirt={C.saffron}
          pants={C.neem}
          look={0.7}
          mood="smile"
          talk={talkAt(frame, 22, 58)}
          left={lerpArm(REST, SHRUG, shrugA)}
          right={lerpArm(REST, SHRUG, shrugA)}
          glasses
          seed={1}
        />
        <Person
          x={bx}
          y={feet}
          s={s}
          skin={SKIN[2]}
          hairStyle="long"
          shirt={C.kumkum}
          pants={C.moss}
          look={-0.7}
          mood="smile"
          talk={talkAt(frame, 60, 96)}
          left={lerpArm(REST, SHRUG, shrugB)}
          right={lerpArm(REST, { a: 12, e: 130 }, shrugB)}
          seed={2}
        />
        <Desk
          x1={vertical ? W * 0.04 : W * 0.5}
          x2={vertical ? W * 0.96 : W * 0.97}
          top={feet - 178 * s}
          bottom={floorY + 70}
        />
        <Question x={ax - 118 * s} y={feet - 425 * s} delay={66} fontFamily={anek.fontFamily} />
        <Question x={bx + 112 * s} y={feet - 440 * s} delay={100} fontFamily={anek.fontFamily} size={100} />
      </Stage>

      {cards.map((c, i) => {
        const p = spring({ frame: frame - c.d, fps, config: { damping: 14, stiffness: 120 } });
        // pinned paper: drops in, then swings on its pin and settles
        const t = Math.max(0, frame - c.d);
        const swing = 12 * Math.exp(-t / 14) * Math.sin(t / 3.2) + Math.sin((frame + i * 25) / 20) * 0.8;
        return (
          <div
            key={c.t}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              transformOrigin: "50% 0",
              transform: `translateY(${(1 - p) * -320}px) rotate(${c.r + swing}deg)`,
              opacity: clamp01(p * 3),
            }}
          >
            <TaskCard title={c.t} tag={c.tag} tagColor={i === 1 ? C.kumkum : C.saffron} width={cardW} />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -12,
                width: 28,
                height: 28,
                marginLeft: -14,
                borderRadius: 99,
                background: i === 1 ? C.haldi : C.kumkum,
                border: `4px solid ${C.neem}`,
                boxShadow: `3px 4px 0 ${C.neem}55`,
              }}
            />
          </div>
        );
      })}

      <AbsoluteFill style={{ justifyContent: "flex-start", padding: pad(vertical) }}>
        <Word text="Status" delay={8} size={size} color={C.neem} bg={C.paper} />
        <Word text="goes" delay={16} size={size} color={C.neem} bg={C.paper} />
        <Word text="stale." delay={24} size={size} color={C.paper} bg={C.kumkum} rotate={-2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 2 — interns speak ───────────────────────── */

const Bars: React.FC<{ n?: number; h: number }> = ({ n = 11, h }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: h * 0.12, height: h }}>
      {Array.from({ length: n }).map((_, i) => {
        const amp = 0.25 + 0.75 * Math.abs(Math.sin(frame / 5 + i * 0.9) * Math.cos(frame / 11 + i * 0.4));
        return <div key={i} style={{ width: h * 0.1, height: h * amp, borderRadius: 99, background: C.neem }} />;
      })}
    </div>
  );
};

const Bubble: React.FC<{ text: string; delay: number; from: "left" | "right"; width: number }> = ({
  text,
  delay,
  from,
  width,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });
  const chars = Math.floor(clamp01((frame - delay - 6) / 34) * text.length);
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        padding: `${width * 0.05}px ${width * 0.07}px`,
        borderRadius: width * 0.09,
        background: C.paper,
        border: `${Math.max(3, width * 0.012)}px solid ${C.neem}`,
        boxShadow: `${width * 0.025}px ${width * 0.025}px 0 ${C.neem}`,
        fontFamily: mukta.fontFamily,
        fontWeight: 700,
        fontSize: width * 0.075,
        color: C.neem,
        transform: `translateX(${(1 - p) * (from === "left" ? -900 : 900)}px) scale(${0.8 + 0.2 * p})`,
        minHeight: width * 0.22,
      }}
    >
      {text.slice(0, chars)}
      <span style={{ opacity: chars < text.length ? 1 : 0 }}>▍</span>
    </div>
  );
};

/** Sound rings rippling out of the phone. */
const Rings: React.FC<{ x: number; y: number; from: number }> = ({ x, y, from }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const t = ((frame - from + i * 12) % 36) / 36;
        return (
          <path
            key={i}
            d={`M ${x + 40 + t * 120} ${y - 50 - t * 90} Q ${x + 80 + t * 170} ${y} ${x + 40 + t * 120} ${y + 50 + t * 90}`}
            fill="none"
            stroke={C.paper}
            strokeWidth={10}
            strokeLinecap="round"
            opacity={1 - t}
          />
        );
      })}
    </g>
  );
};

const SceneSpeak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width: W, height: H } = useLayout();
  const size = vertical ? 230 : 220;
  const sticker = spring({ frame: frame - 34, fps, config: { damping: 9, stiffness: 160 } });
  const bw = vertical ? 760 : 580;
  const s = vertical ? 1.5 : 1.45;
  const px = vertical ? W * 0.27 : W * 0.85;
  const feet = H + 40;
  const raise = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 110 } });
  const phoneArm = lerpArm(REST, { a: 40, e: 175 }, raise);
  // where the phone ends up, for the sound rings
  const phone = { x: px + 50 * s, y: feet - 335 * s };
  const enter = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ background: C.saffron }}>
      <Stage>
        <circle cx={px} cy={feet - 260 * s} r={330 * s * enter} fill={C.haldi} opacity={0.45} />
        <g transform={`translate(0 ${(1 - enter) * 500})`}>
          <Rings x={phone.x} y={phone.y} from={30} />
          <Person
            x={px}
            y={feet}
            s={s}
            skin={SKIN[1]}
            hairStyle="bun"
            shirt={C.tulsi}
            pants={C.neem}
            look={-0.5}
            talk={talkAt(frame, 34, 130)}
            right={phoneArm}
            left={{ a: 14 + Math.sin(frame / 9) * 6, e: 30 + Math.sin(frame / 7) * 14 }}
            phone="right"
            lanyard
            seed={3}
          />
        </g>
      </Stage>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: pad(vertical) }}>
        <Word text="Interns" delay={6} size={size} color={C.neem} />
        <Word text="speak." delay={14} size={size} color={C.neem} bg={C.haldi} rotate={1.5} />
        <div
          style={{
            marginTop: size * 0.12,
            marginLeft: size * 0.06,
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            alignSelf: "flex-start",
            padding: "14px 34px",
            borderRadius: 999,
            background: C.paper,
            border: `5px solid ${C.neem}`,
            boxShadow: `8px 8px 0 ${C.neem}`,
            transform: `scale(${sticker})`,
            transformOrigin: "left center",
          }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 99, background: C.kumkum }} />
          <Bars h={64} />
          <span style={{ fontFamily: mukta.fontFamily, fontWeight: 700, fontSize: 40, color: C.neem }}>20 sec</span>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: vertical ? "9%" : "24%",
          bottom: vertical ? "34%" : "24%",
          display: "flex",
          flexDirection: "column",
          gap: 34,
          alignItems: "flex-end",
        }}
      >
        <Bubble text="Login page is done." delay={36} from="right" width={bw} />
        <Bubble text="Blocked on the API key." delay={76} from="right" width={bw} />
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 3 — the board updates ───────────────────────── */

const Column: React.FC<{ title: string; width: number; height: number; accent: string }> = ({
  title,
  width,
  height,
  accent,
}) => (
  <div
    style={{
      width,
      height,
      boxSizing: "border-box",
      borderRadius: 36,
      background: C.neemDeep,
      border: `4px solid ${C.neemSoft}`,
      padding: 22,
    }}
  >
    <div style={{ fontFamily: mukta.fontFamily, fontWeight: 700, fontSize: 34, color: accent, letterSpacing: "0.01em" }}>
      {title}
    </div>
  </div>
);

const SceneBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width: W, height: H } = useLayout();
  const size = vertical ? 190 : 175;
  const colW = vertical ? 262 : 268;
  const colH = vertical ? 520 : 560;
  const gap = vertical ? 21 : 20;
  const cardW = colW - 44;
  const bezel = 22;
  const boardW = colW * 3 + gap * 2 + bezel * 2 + 16;

  // organizer who walks up and points at the board
  const enter = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 80 } });
  const point = ease(clamp01((frame - 40) / 14));
  const cheer = ease(clamp01((frame - 118) / 12));
  const ps = vertical ? 1.15 : 1;
  const px = vertical ? W * 0.25 : W * 0.27;
  const pFeet = H + (vertical ? 20 : 10) + (1 - enter) * 420;

  const boardIn = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 90 } });
  const move1 = ease(clamp01((frame - 58) / 22)); // to do → in progress
  const move2 = ease(clamp01((frame - 94) / 22)); // in progress → done
  const col = (i: number) => i * (colW + gap) + 22;
  const x = interpolate(move1 + move2, [0, 1, 2], [col(0), col(1), col(2)]);
  const pop = spring({ frame: frame - 116, fps, config: { damping: 7, stiffness: 200 } });
  const underline = ease(clamp01((frame - 40) / 16));

  return (
    <AbsoluteFill style={{ background: C.neem }}>
      <Stage>
        <OfficeBackdrop tone="dusk" clock={false} />
        <Person
          x={px}
          y={pFeet}
          s={ps}
          skin={SKIN[1]}
          hairStyle="short"
          shirt={C.saffron}
          pants={C.neemDeep}
          look={0.7}
          mood={frame > 116 ? "grin" : "smile"}
          talk={talkAt(frame, 52, 100)}
          right={lerpArm(REST, { a: 118, e: 6 }, point)}
          left={lerpArm(REST, { a: 150, e: 20 + Math.sin(frame / 4) * 8 }, cheer)}
          lanyard
          seed={6}
        />
      </Stage>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: vertical ? "21% 9% 0" : "13% 0 0 9%" }}>
        <Word text="The board" delay={6} size={size * 0.78} color={C.paper} />
        <div style={{ position: "relative", alignSelf: "flex-start" }}>
          <Word text="updates." delay={14} size={size} color={C.haldi} />
          <div
            style={{
              position: "absolute",
              left: size * 0.06,
              bottom: size * 0.02,
              height: size * 0.07,
              width: `calc(100% - ${size * 0.12}px)`,
              background: C.saffron,
              borderRadius: 99,
              transformOrigin: "left",
              transform: `scaleX(${underline})`,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* the board lives on a wall-mounted screen */}
      <div
        style={{
          position: "absolute",
          left: vertical ? (W - boardW) / 2 : "auto",
          right: vertical ? "auto" : "8%",
          top: vertical ? "39%" : "19%",
          padding: bezel,
          borderRadius: 54,
          background: C.neemSoft,
          border: `8px solid ${C.neemDeep}`,
          boxShadow: `0 0 0 4px ${C.haldi}55, 0 0 120px ${C.haldi}40, 0 40px 0 -12px ${C.neemDeep}`,
          transform: `translateY(${(1 - boardIn) * 900}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -54,
            left: 28,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "6px 22px",
            borderRadius: 99,
            background: C.neemDeep,
            fontFamily: mukta.fontFamily,
            fontWeight: 700,
            fontSize: 30,
            color: C.paper,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 99,
              background: move2 > 0.95 ? C.tulsi : C.kumkum,
              opacity: 0.6 + 0.4 * Math.abs(Math.sin(frame / 8)),
            }}
          />
          {move2 > 0.95 ? "Updated just now" : "Live"}
        </div>
      <div style={{ position: "relative", display: "flex", gap }}>
        <Column title="To do" width={colW} height={colH} accent={C.paperDeep} />
        <Column title="In progress" width={colW} height={colH} accent={C.haldi} />
        <Column title="Done" width={colW} height={colH} accent={C.tulsi} />
        <div style={{ position: "absolute", left: col(0), top: 88 }}>
          <TaskCard title="Weekly report" width={cardW} tone="neem" />
        </div>
        <div style={{ position: "absolute", left: col(1), top: 88 }}>
          <TaskCard title="API testing" tag="Blocked" tagColor={C.kumkum} width={cardW} tone="neem" />
        </div>
        {/* the card that travels */}
        <div
          style={{
            position: "absolute",
            left: x,
            top: frame < 58 ? 270 : interpolate(move1 + move2, [0, 1, 2], [270, 270, 88]),
            transform: `scale(${1 + 0.08 * Math.sin(Math.PI * move1) + 0.08 * Math.sin(Math.PI * move2)})`,
          }}
        >
          <TaskCard
            title="Login page"
            done={move2 > 0.95}
            tag={move2 > 0.95 ? "Done" : "In progress"}
            tagColor={move2 > 0.95 ? C.tulsi : C.haldi}
            width={cardW}
            tone="paper"
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: col(2) + cardW - 30,
            top: 60,
            width: 78,
            height: 78,
            borderRadius: 99,
            background: C.tulsi,
            border: `5px solid ${C.neem}`,
            display: "grid",
            placeItems: "center",
            fontSize: 44,
            fontWeight: 700,
            color: C.neem,
            transform: `scale(${frame > 116 ? pop : 0})`,
          }}
        >
          ✓
        </div>
      </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 4 — no confusion, target achieved ───────────────────────── */

const SprintCard: React.FC<{ width: number; delay: number; fillFrom: number }> = ({ width, delay, fillFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 110 } });
  const fill = ease(clamp01((frame - fillFrom) / 44));
  const pct = Math.round(lerp(40, 100, fill));
  const done = spring({ frame: frame - fillFrom - 46, fps, config: { damping: 8, stiffness: 180 } });
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        padding: width * 0.06,
        borderRadius: width * 0.06,
        background: C.paper,
        border: `5px solid ${C.neem}`,
        boxShadow: `12px 12px 0 ${C.neem}`,
        fontFamily: mukta.fontFamily,
        color: C.neem,
        transform: `translateX(${(1 - p) * -700}px) rotate(${-2 * p}deg)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: width * 0.075 }}>Sprint goal</span>
        <span style={{ fontFamily: anek.fontFamily, fontWeight: 800, fontSize: width * 0.12 }}>{pct}%</span>
      </div>
      <div
        style={{
          marginTop: width * 0.03,
          height: width * 0.07,
          borderRadius: 99,
          background: C.paperDeep,
          border: `4px solid ${C.neem}`,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: C.tulsi, borderRadius: 99 }} />
      </div>
      <div
        style={{
          marginTop: width * 0.04,
          display: "inline-block",
          padding: `${width * 0.012}px ${width * 0.045}px`,
          borderRadius: 99,
          background: C.tulsi,
          fontWeight: 700,
          fontSize: width * 0.06,
          transform: `scale(${done})`,
          transformOrigin: "left center",
        }}
      >
        Done, on time
      </div>
    </div>
  );
};

const SceneWin: React.FC = () => {
  const frame = useCurrentFrame();
  const { vertical, width: W, height: H } = useLayout();
  const size = vertical ? 128 : 150;
  const s = 1.3;
  const feet = H * (vertical ? 0.93 : 0.96);
  const gap = 392 * s; // hands meet exactly at this spacing
  const center = vertical ? W * 0.5 : W * 0.72;

  const walk = ease(clamp01((frame - 4) / 44));
  const walking = walk < 0.99;
  const ax = lerp(center - gap / 2 - W * 0.4, center - gap / 2, walk);
  const bx = lerp(center + gap / 2 + W * 0.4, center + gap / 2, walk);
  const step = Math.sin(frame / 3.5);
  const bob = walking ? -Math.abs(step) * 14 : 0;
  const swing = walking ? step * 20 : 0;

  const reach = ease(clamp01((frame - 46) / 12));
  const shake = frame >= 58 && frame < 104 ? Math.sin((frame - 58) / 2.6) * 10 : 0;
  const shakeArm: Arm = { a: lerp(8, 45, reach), e: lerp(4, 40, reach) + shake };
  const cheer = ease(clamp01((frame - 106) / 12));
  const cheerArm = (sw: number): Arm => lerpArm({ a: 8 + sw, e: 4 }, { a: 150, e: 18 + Math.sin(frame / 4) * 8 }, cheer);
  const mood = frame > 56 ? "grin" : "smile";

  const target = vertical ? { x: W * 0.72, y: H * 0.47, r: 110 } : { x: center, y: H * 0.24, r: 105 };

  return (
    <AbsoluteFill style={{ background: C.wall }}>
      <Stage>
        <OfficeBackdrop />
        <Bullseye x={target.x} y={target.y} r={target.r} hit={74} />
        <Person
          x={ax}
          y={feet}
          s={s}
          skin={SKIN[3]}
          hairStyle="curly"
          shirt={C.haldi}
          pants={C.neem}
          look={0.6}
          mood={mood}
          bob={bob}
          left={cheerArm(swing)}
          right={reach > 0 ? shakeArm : { a: 8 - swing, e: 4 }}
          lanyard
          seed={4}
        />
        <Person
          x={bx}
          y={feet}
          s={s}
          skin={SKIN[0]}
          hairStyle="long"
          shirt={C.saffron}
          pants={C.moss}
          look={-0.6}
          mood={mood}
          bob={bob}
          left={reach > 0 ? shakeArm : { a: 8 + swing, e: 4 }}
          right={cheerArm(-swing)}
          glasses
          seed={5}
        />
        <Confetti delay={104} />
      </Stage>
      <div style={{ position: "absolute", left: "9%", top: vertical ? "39%" : "62%" }}>
        <SprintCard width={vertical ? 440 : 500} delay={30} fillFrom={50} />
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: pad(vertical) }}>
        <Word text="No confusion." delay={8} size={size} color={C.neem} bg={C.paper} />
        <Word text="Target" delay={18} size={size} color={C.neem} bg={C.paper} />
        <Word text="achieved." delay={26} size={size} color={C.neem} bg={C.tulsi} rotate={-1.5} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 5 — logo turns, colour flows into the name ───────────────────────── */

const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const logo = vertical ? 300 : 260;
  const type = vertical ? 230 : 290;

  const turn = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 55 } });
  const reveal = ease(clamp01((frame - 34) / 26));
  const flow = ease(clamp01((frame - 40) / 40));
  const float = Math.sin(frame / 14) * 6;
  const rays = spring({ frame, fps, config: { damping: 20, stiffness: 60 } });

  const chips: [string, string, string, number][] = [
    ["Speak", C.haldi, C.neem, -4],
    ["Confirm", C.saffron, C.neem, 3],
    ["Done", C.tulsi, C.neem, -2],
  ];
  const tagline = "Your team's voice coordinator.".split(" ");

  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: "center", justifyContent: "center" }}>
      {/* slow sunburst behind the mark */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <svg width={2400} height={2400} viewBox="-1200 -1200 2400 2400" style={{ transform: `scale(${rays}) rotate(${frame * 0.25}deg)` }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={i}
              d="M 0 0 L -90 -1200 L 90 -1200 Z"
              fill={C.haldi}
              opacity={0.28}
              transform={`rotate(${i * 20})`}
            />
          ))}
          <circle r={360} fill={C.paper} />
        </svg>
      </AbsoluteFill>

      <div
        style={{
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          alignItems: "center",
          marginTop: vertical ? -180 : -120,
        }}
      >
        <div style={{ perspective: 1400, transform: `translateY(${float}px)` }}>
          <Img
            src={staticFile("logo.png")}
            style={{
              width: logo,
              height: logo,
              objectFit: "contain",
              transform: `rotateY(${(1 - turn) * 540}deg) scale(${0.3 + 0.7 * turn})`,
              filter: `drop-shadow(0 ${logo * 0.06}px ${logo * 0.05}px ${C.neem}40)`,
            }}
          />
        </div>
        {/* the wordmark grows out of the logo, its colour flowing from orange to green */}
        <div
          style={{
            overflow: "hidden",
            maxWidth: vertical ? "none" : reveal * 1300,
            maxHeight: vertical ? reveal * type * 1.2 : "none",
          }}
        >
          <div
            style={{
              fontFamily: anek.fontFamily,
              fontWeight: 800,
              fontSize: type,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              paddingLeft: vertical ? 0 : 36,
              whiteSpace: "nowrap",
              backgroundImage: `linear-gradient(100deg, ${C.haldi} 0%, ${C.saffron} 25%, ${C.saffron} 40%, ${C.neemSoft} 70%, ${C.neem} 100%)`,
              backgroundSize: "260% 100%",
              backgroundPosition: `${lerp(0, 62, flow)}% 0`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              transform: `translateX(${(1 - reveal) * (vertical ? 0 : -120)}px)`,
            }}
          >
            taskora
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: vertical ? "62%" : "64%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: vertical ? 44 : 36,
          padding: "0 9%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 0.3em",
            fontFamily: mukta.fontFamily,
            fontWeight: 700,
            fontSize: vertical ? 58 : 70,
            color: C.neem,
          }}
        >
          {tagline.map((w, i) => {
            const p = spring({ frame: frame - 62 - i * 4, fps, config: { damping: 14, stiffness: 130 } });
            return (
              <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
                {w}
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {chips.map(([label, bg, fg, rot], i) => {
            const p = spring({ frame: frame - 86 - i * 6, fps, config: { damping: 9, stiffness: 170 } });
            return (
              <div
                key={label}
                style={{
                  padding: "12px 34px",
                  borderRadius: 999,
                  background: bg,
                  color: fg,
                  border: `5px solid ${C.neem}`,
                  boxShadow: `6px 6px 0 ${C.neem}`,
                  fontFamily: mukta.fontFamily,
                  fontWeight: 700,
                  fontSize: 44,
                  transform: `scale(${p}) rotate(${rot * p}deg)`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Logo lockup, drawn in the video so it is always legible on the current scene. */
const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const { vertical } = useLayout();
  if (frame >= AT.brand) return null; // the end card has its own big logo
  const ink = frame >= AT.board && frame < AT.win ? C.paper : C.neem;
  return (
    <div
      style={{
        position: "absolute",
        left: "9%",
        top: vertical ? 64 : 44,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: 64, height: 64, objectFit: "contain" }} />
      <span style={{ fontFamily: anek.fontFamily, fontWeight: 800, fontSize: 46, lineHeight: 1, color: ink, letterSpacing: "-0.01em" }}>
        taskora
      </span>
    </div>
  );
};

/* ───────────────────────── Voiceover ───────────────────────── */

/** Kokoro clips from `pnpm video:voice`; each starts `at` frames into its scene. */
const Voiceover: React.FC = () => (
  <>
    {voiceover.lines.map(({ id, scene, at }) => (
      <Sequence key={id} from={AT[scene as keyof typeof AT] + at} layout="none">
        <Html5Audio src={staticFile(`voice/${id}.wav`)} />
      </Sequence>
    ))}
  </>
);

/* ───────────────────────── Camera + timeline ───────────────────────── */

/** Frames where the outgoing and incoming scenes overlap during a zoom transition. */
const ZOOM = 16;
const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);

/**
 * Camera for one scene: it zooms out of a soft blur on entry, pushes in slowly while it plays,
 * then punches in toward its focal point (`focus`, % of the frame) as the next scene arrives.
 */
const Shot: React.FC<{
  dur: number;
  focus: { h: [number, number]; v: [number, number] };
  exit?: boolean;
  children: React.ReactNode;
}> = ({ dur, focus, exit = true, children }) => {
  const frame = useCurrentFrame();
  const { vertical } = useLayout();
  const inE = easeOut(clamp01(frame / 20));
  const outE = exit ? easeIn(clamp01((frame - (dur - 8)) / (ZOOM + 8))) : 0;
  const scale = lerp(1.3, 1, inE) * (1 + 0.025 * clamp01(frame / dur)) * lerp(1, 1.9, outE);
  const blur = (1 - inE) * 14 + outE * 10;
  const [fx, fy] = vertical ? focus.v : focus.h;
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: `${fx}% ${fy}%`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        opacity: clamp01(frame / 10),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const scenes: {
  from: number;
  to: number;
  focus: { h: [number, number]; v: [number, number] };
  Scene: React.FC;
}[] = [
  { from: AT.stale, to: AT.speak, focus: { h: [70, 20], v: [50, 50] }, Scene: SceneStale },
  { from: AT.speak, to: AT.board, focus: { h: [88, 58], v: [35, 78] }, Scene: SceneSpeak },
  { from: AT.board, to: AT.win, focus: { h: [78, 35], v: [78, 50] }, Scene: SceneBoard },
  { from: AT.win, to: AT.brand, focus: { h: [72, 24], v: [72, 47] }, Scene: SceneWin },
  { from: AT.brand, to: DURATION, focus: { h: [50, 40], v: [50, 40] }, Scene: SceneBrand },
];

export const HeroLoop: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper }}>
    {scenes.map(({ from, to, focus, Scene }) => {
      const last = to === DURATION;
      return (
        <Sequence key={from} from={from} durationInFrames={to - from + (last ? 0 : ZOOM)}>
          <Shot dur={to - from} focus={focus} exit={!last}>
            <Scene />
          </Shot>
        </Sequence>
      );
    })}
    <Brand />
    <Voiceover />
    <Grain />
    <Wipe at={AT.stale} color={C.neem} />
    {/* ends fully paper so the page's office scene can fade in over it */}
    <Wipe at={DURATION - 1} color={C.paper} stay />
  </AbsoluteFill>
);
