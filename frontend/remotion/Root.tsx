import React from "react";
import { Composition } from "remotion";
import { DURATION, FPS, HeroLoop } from "./HeroLoop";
import { OFFICE_DURATION, OFFICE_FPS, OfficeLoop } from "./OfficeLoop";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="HeroLoop"
      component={HeroLoop}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="HeroLoopVertical"
      component={HeroLoop}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="OfficeLoop"
      component={OfficeLoop}
      durationInFrames={OFFICE_DURATION}
      fps={OFFICE_FPS}
      width={1600}
      height={900}
    />
  </>
);
