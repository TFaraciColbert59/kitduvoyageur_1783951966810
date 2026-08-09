'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { springConfigs } from '@/lib/animations/constants';

interface StaggerGridProps {
  children: React.ReactNode[];
  columns?: 2 | 3 | 4;
  staggerDelay?: number;
}

export default function StaggerGrid({
  children,
  columns = 2,
  staggerDelay = 0.05
}: StaggerGridProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { ...springConfigs.smooth, delay: i * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export { StaggerGrid };
