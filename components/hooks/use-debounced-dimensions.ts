"use client";
import { useState, useEffect, RefObject } from "react";

interface Dimensions { width: number; height: number; }

export function useDimensions(ref: RefObject<HTMLElement | SVGElement>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const update = () => {
      if (ref.current) {
        const { width, height } = ref.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    const debounced = () => { clearTimeout(timeoutId); timeoutId = setTimeout(update, 250); };
    update();
    window.addEventListener("resize", debounced);
    return () => { window.removeEventListener("resize", debounced); clearTimeout(timeoutId); };
  }, [ref]);

  return dimensions;
}
