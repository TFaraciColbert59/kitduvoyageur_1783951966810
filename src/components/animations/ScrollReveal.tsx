'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { springConfigs } from '@/lib/animations/constants';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  threshold?: number;
}

export default function ScrollReveal({
  children,
  delay = 0,
  threshold = 0.2
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
      animate={isInView ? (shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }) : (shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 })}
      transition={{ ...springConfigs.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

export { ScrollReveal };
