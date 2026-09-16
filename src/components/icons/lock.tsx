"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (pop, nudge-up).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type LockIconHandle = AnimatedIconHandle;

interface LockIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const LockIcon = forwardRef<LockIconHandle, LockIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect data-anim="pop" x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path data-anim="nudge-up" d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    </AnimatedIconBase>
  )
);

LockIcon.displayName = "LockIcon";

export { LockIcon };
