"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { useDimensions } from "@/components/hooks/use-debounced-dimensions";

interface PixelTrailProps {
  pixelSize?: number;
  fadeDuration?: number;
  delay?: number;
  className?: string;
  pixelClassName?: string;
}

export const PixelTrail: React.FC<PixelTrailProps> = ({
  pixelSize = 28,
  fadeDuration = 600,
  delay = 0,
  className,
  pixelClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef as React.RefObject<HTMLElement>);
  const trailId = useRef(uuidv4());

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);
    const el = document.getElementById(`${trailId.current}-pixel-${x}-${y}`);
    if (el) { const fn = (el as unknown as { __animatePixel?: () => void }).__animatePixel; if (fn) fn(); }
  }, [pixelSize]);

  const columns = useMemo(() => Math.ceil(dimensions.width / pixelSize), [dimensions.width, pixelSize]);
  const rows = useMemo(() => Math.ceil(dimensions.height / pixelSize), [dimensions.height, pixelSize]);

  return (
    <div ref={containerRef} className={cn("absolute inset-0 w-full h-full pointer-events-auto", className)} onMouseMove={handleMouseMove}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex">
          {Array.from({ length: columns }).map((_, c) => (
            <PixelDot key={`${c}-${r}`} id={`${trailId.current}-pixel-${c}-${r}`} size={pixelSize} fadeDuration={fadeDuration} delay={delay} className={pixelClassName} />
          ))}
        </div>
      ))}
    </div>
  );
};

interface PixelDotProps { id: string; size: number; fadeDuration: number; delay: number; className?: string; }

const PixelDot: React.FC<PixelDotProps> = React.memo(({ id, size, fadeDuration, delay, className }) => {
  const controls = useAnimationControls();
  const animatePixel = useCallback(() => {
    controls.start({ opacity: [0.9, 0], transition: { duration: fadeDuration / 1000, delay: delay / 1000, ease: "easeOut" } });
  }, [controls, fadeDuration, delay]);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) (node as unknown as { __animatePixel: () => void }).__animatePixel = animatePixel;
  }, [animatePixel]);

  return (
    <motion.div id={id} ref={ref} className={cn(className)} style={{ width: `${size}px`, height: `${size}px` }} initial={{ opacity: 0 }} animate={controls} />
  );
});
PixelDot.displayName = "PixelDot";
