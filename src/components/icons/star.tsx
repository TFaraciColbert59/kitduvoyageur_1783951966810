"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (spin).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type StarIconHandle = AnimatedIconHandle;

interface StarIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const StarIcon = forwardRef<StarIconHandle, StarIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon data-anim="spin" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    </AnimatedIconBase>
  )
);

StarIcon.displayName = "StarIcon";

export { StarIcon };
