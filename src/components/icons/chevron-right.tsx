"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (nudge-right).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type ChevronRightIconHandle = AnimatedIconHandle;

interface ChevronRightIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const ChevronRightIcon = forwardRef<ChevronRightIconHandle, ChevronRightIconProps>(
  ({ className, size = 28, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path data-anim="nudge-right" d="m9 18 6-6-6-6" />
      </svg>
    </AnimatedIconBase>
  )
);

ChevronRightIcon.displayName = "ChevronRightIcon";

export { ChevronRightIcon };
