import type { Transition, Variants } from "framer-motion";

function cssMs(name: string, fallbackMs: number): number {
  if (typeof document === "undefined") return fallbackMs / 1000;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = parseFloat(raw);
  return Number.isFinite(ms) ? ms / 1000 : fallbackMs / 1000;
}

export const easeStandard = [0.25, 0.1, 0.25, 1] as const;

export const duration = {
  fast: cssMs("--motion-duration-fast", 150),
  base: cssMs("--motion-duration-base", 250),
  slow: cssMs("--motion-duration-slow", 350),
  stagger: cssMs("--motion-duration-stagger", 30),
  page: 0.3,
};

export const transition = {
  fast: { duration: duration.fast, ease: easeStandard } satisfies Transition,
  reduced: { duration: 0.01 } satisfies Transition,
  base: { duration: duration.base, ease: easeStandard } satisfies Transition,
  slow: { duration: duration.slow, ease: easeStandard } satisfies Transition,
  page: { duration: duration.page, ease: easeStandard } satisfies Transition,
};

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export const overlayFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};
