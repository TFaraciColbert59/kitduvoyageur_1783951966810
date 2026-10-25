"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (scale-x, scale-x, scale-x).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type MenuIconHandle = AnimatedIconHandle;

interface MenuIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const MenuIcon = forwardRef<MenuIconHandle, MenuIconProps>(
  ({ className, size = 20, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line data-anim="scale-x" x1="4" y1="6" x2="20" y2="6" />
          <line data-anim="scale-x" x1="4" y1="12" x2="20" y2="12" />
          <line data-anim="scale-x" x1="4" y1="18" x2="20" y2="18" />
        </svg>
    </AnimatedIconBase>
  )
);

MenuIcon.displayName = "MenuIcon";

export { MenuIcon };
