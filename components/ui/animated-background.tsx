"use client";

import { GooeyFilter } from "./gooey-filter";
import { PixelTrail } from "./pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";

export function AnimatedBackground() {
  const screenSize = useScreenSize();

  return (
    <>
      <GooeyFilter id="gooey-bg" strength={4} />

      {/* Static grid + scanlines (existing) */}
      <div className="bg-grid" />
      <div className="scanlines" />

      {/* Pixel trail layer */}
      <div
        className="absolute inset-0 z-0"
        style={{ filter: "url(#gooey-bg)", pointerEvents: "auto" }}
      >
        <PixelTrail
          pixelSize={screenSize.lessThan("md") ? 20 : 28}
          fadeDuration={800}
          delay={0}
          pixelClassName="pixel-red"
        />
      </div>
    </>
  );
}
