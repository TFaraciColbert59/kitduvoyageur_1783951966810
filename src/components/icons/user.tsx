"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (draw, draw:0.2).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type UserIconHandle = AnimatedIconHandle;

interface UserIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const UserIcon = forwardRef<UserIconHandle, UserIconProps>(
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
          <circle data-anim="draw" pathLength="1" cx="12" cy="8" r="5" />

          <path data-anim="draw" data-delay="0.2" pathLength="1" d="M20 21a8 8 0 0 0-16 0" />
        </svg>
    </AnimatedIconBase>
  )
);

UserIcon.displayName = "UserIcon";

export { UserIcon };
