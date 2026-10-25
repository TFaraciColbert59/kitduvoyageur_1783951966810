"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedIconBase, type AnimatedIconHandle } from "./animated-base";

/**
 * P1-3 (fin) — converti framer-motion → CSS (bounce-y, draw:0.2).
 * API inchangée : forwardRef startAnimation/stopAnimation, taille, classe.
 */

export type MapPinIconHandle = AnimatedIconHandle;

interface MapPinIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const MapPinIcon = forwardRef<MapPinIconHandle, MapPinIconProps>(
  ({ className, size = 28, ...props }, ref) => (
    <AnimatedIconBase ref={ref} className={cn(className)} size={size} {...props}>
      <svg data-anim="bounce-y" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" >
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle data-anim="draw" data-delay="0.2" pathLength="1" cx="12" cy="10" r="3" />
        </svg>
    </AnimatedIconBase>
  )
);

MapPinIcon.displayName = "MapPinIcon";

export { MapPinIcon };
