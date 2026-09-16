"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (bounce-y).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type SearchIconHandle = AnimatedIconHandle;

interface SearchIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const SearchIcon = forwardRef<SearchIconHandle, SearchIconProps>(
  ({ className, size = 28, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg data-anim="bounce-y" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
    </AnimatedIconBase>
  )
);

SearchIcon.displayName = "SearchIcon";

export { SearchIcon };
