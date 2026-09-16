"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (spin).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type PlusIconHandle = AnimatedIconHandle;

interface PlusIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const PlusIcon = forwardRef<PlusIconHandle, PlusIconProps>(
  ({ className, size = 28, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg data-anim="spin" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
    </AnimatedIconBase>
  )
);

PlusIcon.displayName = "PlusIcon";

export { PlusIcon };
