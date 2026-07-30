'use client';

import { motion } from 'framer-motion';
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
  const { light, medium } = useHapticFeedback();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, { offset, velocity }) => {
        setIsDragging(false);
        if (offset.x < -100 && velocity.x < -200 && onSwipeLeft) {
          medium();
          onSwipeLeft();
        } else if (offset.x > 100 && velocity.x > 200 && onSwipeRight) {
          medium();
          onSwipeRight();
        }
      }}
      onTap={() => {
        if (!isDragging && onTap) {
          light();
          onTap();
        }
      }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}
