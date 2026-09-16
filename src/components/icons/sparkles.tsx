"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (twinkle, twinkle, twinkle, twinkle, twinkle).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type SparklesIconHandle = AnimatedIconHandle;

interface SparklesIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const SparklesIcon = forwardRef<SparklesIconHandle, SparklesIconProps>(
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
          <path data-anim="twinkle" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path data-anim="twinkle" d="M20 3v4" />
          <path data-anim="twinkle" d="M22 5h-4" />
          <path data-anim="twinkle" d="M4 17v2" />
          <path data-anim="twinkle" d="M5 18H3" />
        </svg>
    </AnimatedIconBase>
  )
);

SparklesIcon.displayName = "SparklesIcon";

export { SparklesIcon };
