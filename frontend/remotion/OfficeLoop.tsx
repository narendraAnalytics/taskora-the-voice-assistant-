import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";

export const OFFICE_FPS = 24;
export const OFFICE_DURATION = 240;

/**
 * The office footage with its generator watermark (a small star, bottom right) covered by a
 * Taskora sticker. Source video and logo live in remotion/assets (render with --public-dir).
 */
export const OfficeLoop: React.FC = () => (
  <AbsoluteFill style={{ background: "#fce7b2" }}>
    <OffthreadVideo src={staticFile("office-source.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <div
      style={{
        position: "absolute",
        left: 1450 - 62,
        top: 750 - 62,
        width: 124,
        height: 124,
        borderRadius: "50%",
        background: "#fce7b2",
        border: "5px solid #173f30",
        boxShadow: "5px 5px 0 #173f30",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: 76, height: 76, objectFit: "contain" }} />
    </div>
  </AbsoluteFill>
);
