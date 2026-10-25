"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (pop, nudge-up).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type ShoppingBagIconHandle = AnimatedIconHandle;

interface ShoppingBagIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const ShoppingBagIcon = forwardRef<ShoppingBagIconHandle, ShoppingBagIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path data-anim="pop" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path data-anim="nudge-up" d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    </AnimatedIconBase>
  )
);

ShoppingBagIcon.displayName = "ShoppingBagIcon";

export { ShoppingBagIcon };
