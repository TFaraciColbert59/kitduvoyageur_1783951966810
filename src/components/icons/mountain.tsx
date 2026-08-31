"use client";

import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface MountainIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface MountainIconProps extends HTMLAttributes<HTMLDivElement> {
  strokeWidth?: number;
  size?: number;
}

const MountainIcon = forwardRef<MountainIconHandle, MountainIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    return (
      <div
        className={cn(className)}
        onMouseEnter={() => controls.start('animate')}
        onMouseLeave={() => controls.start('normal')}
        onClick={() => controls.start('animate')}
        onTouchStart={() => controls.start('animate')}
        {...props}
      >
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
          <motion.path
            animate={controls}
            d="m8 3 4 8 5-5 5 15H2L8 3z"
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
            }}
            variants={{
              normal: { scale: 1, y: 0 },
              animate: { scale: [1, 1.12, 0.95, 1], y: [0, -2, 0] },
            }}
          />
        </svg>
      </div>
    );
  }
);

MountainIcon.displayName = 'MountainIcon';

export { MountainIcon };
