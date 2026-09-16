"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (squash).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type BookmarkIconHandle = AnimatedIconHandle;

interface BookmarkIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const BookmarkIcon = forwardRef<BookmarkIconHandle, BookmarkIconProps>(
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
          <path data-anim="squash" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" style={{ transformOrigin: '50% 0%' }} />
        </svg>
    </AnimatedIconBase>
  )
);

BookmarkIcon.displayName = "BookmarkIcon";

export { BookmarkIcon };
