'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GestureCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
}

export function GestureCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onTap
}: GestureCardProps) {
  const { haptic } = useHapticFeedback();
  const [isDragging, setIsDragging] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, { offset, velocity }) => {
        setIsDragging(false);
        if (offset.x < -100 && velocity.x < -200 && onSwipeLeft) {
          haptic('medium');
          onSwipeLeft();
        } else if (offset.x > 100 && velocity.x > 200 && onSwipeRight) {
          haptic('medium');
          onSwipeRight();
        }
      }}
      onTap={() => {
        if (!isDragging && onTap) {
          haptic('light');
          onTap();
        }
      }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      style={{ touchAction: shouldReduceMotion ? 'auto' : 'pan-y' }}
    >
      {children}
    </motion.div>
  );
}