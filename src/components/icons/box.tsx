"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (draw, draw, draw).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type BoxIconHandle = AnimatedIconHandle;

interface BoxIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const BoxIcon = forwardRef<BoxIconHandle, BoxIconProps>(
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
          <path data-anim="draw" pathLength="1" d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path data-anim="draw" pathLength="1" d="m3.3 7 8.7 5 8.7-5" />
          <path data-anim="draw" pathLength="1" d="M12 22V12" />
        </svg>
    </AnimatedIconBase>
  )
);

BoxIcon.displayName = "BoxIcon";

export { BoxIcon };
