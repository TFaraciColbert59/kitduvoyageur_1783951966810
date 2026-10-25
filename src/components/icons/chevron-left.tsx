"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (nudge-left).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type ChevronLeftIconHandle = AnimatedIconHandle;

interface ChevronLeftIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const ChevronLeftIcon = forwardRef<ChevronLeftIconHandle, ChevronLeftIconProps>(
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
          <path data-anim="nudge-left" d="m15 18-6-6 6-6" />
        </svg>
    </AnimatedIconBase>
  )
);

ChevronLeftIcon.displayName = "ChevronLeftIcon";

export { ChevronLeftIcon };
