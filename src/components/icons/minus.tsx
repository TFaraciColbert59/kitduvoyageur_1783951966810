"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (scale-x).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type MinusIconHandle = AnimatedIconHandle;

interface MinusIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const MinusIcon = forwardRef<MinusIconHandle, MinusIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line data-anim="scale-x" x1="5" y1="12" x2="19" y2="12" />
        </svg>
    </AnimatedIconBase>
  )
);

MinusIcon.displayName = "MinusIcon";

export { MinusIcon };
