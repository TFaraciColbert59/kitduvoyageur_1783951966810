"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (nudge-left, nudge-left).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type UsersIconHandle = AnimatedIconHandle;

interface UsersIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const UsersIcon = forwardRef<UsersIconHandle, UsersIconProps>(
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
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path data-anim="nudge-left" d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path data-anim="nudge-left" d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    </AnimatedIconBase>
  )
);

UsersIcon.displayName = "UsersIcon";

export { UsersIcon };
