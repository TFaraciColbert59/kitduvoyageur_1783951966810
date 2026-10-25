"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (pop).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type TentIconHandle = AnimatedIconHandle;

interface TentIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const TentIcon = forwardRef<TentIconHandle, TentIconProps>(
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
          <path data-anim="pop" d="M3.5 21 14 3l10.5 18H3.5z" />
          <path d="M8.5 21 14 11l5.5 10" />
        </svg>
    </AnimatedIconBase>
  )
);

TentIcon.displayName = "TentIcon";

export { TentIcon };
