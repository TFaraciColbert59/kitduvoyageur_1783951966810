"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (spin).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type FilterIconHandle = AnimatedIconHandle;

interface FilterIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const FilterIcon = forwardRef<FilterIconHandle, FilterIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon data-anim="spin" points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
    </AnimatedIconBase>
  )
);

FilterIcon.displayName = "FilterIcon";

export { FilterIcon };
