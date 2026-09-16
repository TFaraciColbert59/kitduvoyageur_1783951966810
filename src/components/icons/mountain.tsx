"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (pop).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type MountainIconHandle = AnimatedIconHandle;

interface MountainIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const MountainIcon = forwardRef<MountainIconHandle, MountainIconProps>(
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
          <path data-anim="pop" d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
    </AnimatedIconBase>
  )
);

MountainIcon.displayName = "MountainIcon";

export { MountainIcon };
