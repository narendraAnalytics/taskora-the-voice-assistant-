import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadAnek } from "@remotion/google-fonts/AnekTelugu";
import { loadFont as loadMukta } from "@remotion/google-fonts/Mukta";

const anek = loadAnek("normal", { weights: ["800"], subsets: ["latin"] });
const mukta = loadMukta("normal", { weights: ["600", "700"], subsets: ["latin"] });

const C = {
  neem: "#173f30",
  neemDeep: "#11332a",
  neemSoft: "#24543f",
  haldi: "#f2b33d",
  saffron: "#e8622a",
  paper: "#fce7b2",
  paperDeep: "#f3d488",
  tulsi: "#7dbe8f",
  kumkum: "#b23a48",
};

export const FPS = 30;
export const DURATION = 360;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = Easing.bezier(0.7, 0, 0.2, 1);

function useLayout() {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height > width };
}

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

/** Five colour strips that sweep in, then out. `at` is the frame it fully covers. */
const Wipe: React.FC<{ at: number; color: string }> = ({ at, color }) => {
  const frame = useCurrentFrame();
  const strips = 5;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", flexDirection: "row" }}>
      {Array.from({ length: strips }).map((_, i) => {
        const entering = frame < at;
        const t = entering
          ? ease(clamp01((frame - (at - 16) - i * 2) / 12))
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

/** Task card — the one visual object of the whole piece. */
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

/* ───────────────────────── Scene 1 — status goes stale ───────────────────────── */

const SceneStale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const size = vertical ? 215 : 250;
  const cards = [
    { t: "Login page", tag: "3 days ago", x: vertical ? 6 : 54, y: vertical ? 56 : 14, r: -6, d: 14 },
    { t: "Weekly report", tag: "Overdue", x: vertical ? 40 : 66, y: vertical ? 66 : 40, r: 5, d: 20 },
    { t: "API testing", tag: "No update", x: vertical ? 8 : 55, y: vertical ? 78 : 62, r: -3, d: 26 },
  ];
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {cards.map((c, i) => {
        const p = spring({ frame: frame - c.d, fps, config: { damping: 13, stiffness: 100 } });
        const bob = Math.sin((frame + i * 20) / 14) * 8;
        return (
          <div
            key={c.t}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              transform: `translateY(${(1 - p) * 700 + bob}px) rotate(${c.r * p}deg) scale(${0.6 + 0.4 * p})`,
            }}
          >
            <TaskCard title={c.t} tag={c.tag} tagColor={i === 1 ? C.kumkum : C.saffron} width={vertical ? 440 : 420} />
          </div>
        );
      })}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          padding: vertical ? "23% 6% 0" : "10% 0 0 9%",
        }}
      >
        <Word text="Status" delay={2} size={size} color={C.neem} />
        <Word text="goes" delay={8} size={size} color={C.neem} />
        <Word text="stale." delay={14} size={size} color={C.paper} bg={C.kumkum} rotate={-2} />
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
        return (
          <div
            key={i}
            style={{ width: h * 0.1, height: h * amp, borderRadius: 99, background: C.neem }}
          />
        );
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
  const chars = Math.floor(clamp01((frame - delay - 6) / 24) * text.length);
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

const SceneSpeak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const size = vertical ? 230 : 270;
  const sticker = spring({ frame: frame - 28, fps, config: { damping: 9, stiffness: 160 } });
  const bw = vertical ? 800 : 700;
  return (
    <AbsoluteFill style={{ background: C.saffron }}>
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          padding: vertical ? "23% 6% 0" : "10% 0 0 9%",
        }}
      >
        <Word text="Interns" delay={2} size={size} color={C.neem} />
        <Word text="speak." delay={9} size={size} color={C.neem} bg={C.haldi} rotate={1.5} />
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
          <span style={{ fontFamily: mukta.fontFamily, fontWeight: 700, fontSize: 40, color: C.neem }}>
            20 sec
          </span>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: vertical ? "6%" : "9%",
          bottom: vertical ? "20%" : "26%",
          display: "flex",
          flexDirection: "column",
          gap: 34,
          alignItems: "flex-end",
        }}
      >
        <Bubble text="Login page is done." delay={22} from="right" width={bw} />
        <Bubble text="Blocked on the API key." delay={44} from="right" width={bw} />
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
    <div
      style={{
        fontFamily: mukta.fontFamily,
        fontWeight: 700,
        fontSize: 34,
        color: accent,
        letterSpacing: "0.01em",
      }}
    >
      {title}
    </div>
  </div>
);

const SceneBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const size = vertical ? 190 : 175;
  const colW = vertical ? 318 : 268;
  const colH = vertical ? 520 : 560;
  const gap = vertical ? 21 : 20;
  const boardX = vertical ? 54 : 0;
  const cardW = colW - 44;

  const boardIn = spring({ frame: frame - 16, fps, config: { damping: 16, stiffness: 90 } });
  const move1 = ease(clamp01((frame - 44) / 18)); // todo → doing
  const move2 = ease(clamp01((frame - 70) / 18)); // doing → done
  const col = (i: number) => i * (colW + gap) + 22;
  const x = interpolate(move1 + move2, [0, 1, 2], [col(0), col(1), col(2)]);
  const pop = spring({ frame: frame - 86, fps, config: { damping: 7, stiffness: 200 } });
  const underline = ease(clamp01((frame - 34) / 14));

  return (
    <AbsoluteFill style={{ background: C.neem }}>
      <AbsoluteFill
        style={{ justifyContent: "flex-start", padding: vertical ? "21% 6% 0" : "13% 0 0 9%" }}
      >
        <Word text="The board" delay={2} size={size * 0.78} color={C.paper} />
        <div style={{ position: "relative", alignSelf: "flex-start" }}>
          <Word text="updates." delay={9} size={size} color={C.haldi} />
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

      <div
        style={{
          position: "absolute",
          left: vertical ? boardX : "auto",
          right: vertical ? "auto" : "9%",
          top: vertical ? "40%" : "21%",
          display: "flex",
          gap,
          transform: `translateY(${(1 - boardIn) * 900}px)`,
        }}
      >
        <Column title="To do" width={colW} height={colH} accent={C.paperDeep} />
        <Column title="In progress" width={colW} height={colH} accent={C.haldi} />
        <Column title="Done" width={colW} height={colH} accent={C.tulsi} />
        {/* resting cards */}
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
            top: frame < 44 ? 270 : interpolate(move1 + move2, [0, 1, 2], [270, 270, 88]),
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
            transform: `scale(${frame > 86 ? pop : 0})`,
          }}
        >
          ✓
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Scene 4 — end card ───────────────────────── */

const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const size = vertical ? 300 : 360;
  const chips: [string, string, string, number][] = [
    ["Speak", C.paper, C.neem, -4],
    ["Confirm", C.saffron, C.neem, 3],
    ["Done", C.neem, C.haldi, -2],
  ];
  return (
    <AbsoluteFill
      style={{
        background: C.haldi,
        alignItems: vertical ? "flex-start" : "center",
        justifyContent: "center",
        padding: vertical ? "0 6%" : 0,
        paddingBottom: vertical ? "15%" : "9%",
      }}
    >
      <Word text="Taskora" delay={2} size={size} color={C.neem} />
      <div style={{ display: "flex", gap: 24, marginTop: 28, marginLeft: vertical ? size * 0.06 : 0 }}>
        {chips.map(([label, bg, fg, rot], i) => {
          const p = spring({ frame: frame - 16 - i * 6, fps, config: { damping: 9, stiffness: 170 } });
          return (
            <div
              key={label}
              style={{
                padding: "16px 40px",
                borderRadius: 999,
                background: bg,
                color: fg,
                border: `5px solid ${C.neem}`,
                boxShadow: `7px 7px 0 ${C.neem}`,
                fontFamily: mukta.fontFamily,
                fontWeight: 700,
                fontSize: vertical ? 48 : 56,
                transform: `scale(${p}) rotate(${rot * p}deg)`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Logo lockup, drawn in the video so it is always legible on the current scene. */
const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const { vertical } = useLayout();
  const ink = frame >= 196 && frame < 300 ? C.paper : C.neem;
  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? "6%" : "9%",
        top: vertical ? 64 : 44,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: 64, height: 64, objectFit: "contain" }} />
      <span
        style={{
          fontFamily: anek.fontFamily,
          fontWeight: 800,
          fontSize: 46,
          lineHeight: 1,
          color: ink,
          letterSpacing: "-0.01em",
        }}
      >
        taskora
      </span>
    </div>
  );
};

/* ───────────────────────── Timeline ───────────────────────── */

export const HeroLoop: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper }}>
    <Sequence from={0} durationInFrames={96}>
      <SceneStale />
    </Sequence>
    <Sequence from={96} durationInFrames={100}>
      <SceneSpeak />
    </Sequence>
    <Sequence from={196} durationInFrames={104}>
      <SceneBoard />
    </Sequence>
    <Sequence from={300} durationInFrames={60}>
      <SceneBrand />
    </Sequence>
    <Brand />
    <Grain />
    <Wipe at={0} color={C.neem} />
    <Wipe at={96} color={C.neem} />
    <Wipe at={196} color={C.haldi} />
    <Wipe at={300} color={C.saffron} />
    <Wipe at={360} color={C.paper} />
  </AbsoluteFill>
);
