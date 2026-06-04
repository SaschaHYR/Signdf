"use client";
import { useEffect, useState } from "react";

const SCREEN_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
export type ScreenSize = (typeof SCREEN_SIZES)[number];

const sizeOrder: Record<ScreenSize, number> = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4, "2xl": 5 };

class ComparableScreenSize {
  constructor(private value: ScreenSize) {}
  toString(): ScreenSize { return this.value; }
  valueOf(): number { return sizeOrder[this.value]; }
  lessThan(other: ScreenSize): boolean { return this.valueOf() < sizeOrder[other]; }
  greaterThan(other: ScreenSize): boolean { return this.valueOf() > sizeOrder[other]; }
  lessThanOrEqual(other: ScreenSize): boolean { return this.valueOf() <= sizeOrder[other]; }
  greaterThanOrEqual(other: ScreenSize): boolean { return this.valueOf() >= sizeOrder[other]; }
  equals(other: ScreenSize): boolean { return this.value === other; }
}

export function useScreenSize(): ComparableScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>("xs");
  useEffect(() => {
    const handle = () => {
      const w = window.innerWidth;
      if (w >= 1536) setScreenSize("2xl");
      else if (w >= 1280) setScreenSize("xl");
      else if (w >= 1024) setScreenSize("lg");
      else if (w >= 768) setScreenSize("md");
      else if (w >= 640) setScreenSize("sm");
      else setScreenSize("xs");
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return new ComparableScreenSize(screenSize);
}
