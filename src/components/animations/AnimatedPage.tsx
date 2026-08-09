'use client';

import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { springConfigs, pageTransitions } from '@/lib/animations/constants';

interface AnimatedPageProps {
  children: React.ReactNode;
  variant?: 'slideUp' | 'fadeIn' | 'slideRight';
  gestureEnabled?: boolean;
}

export default function AnimatedPage({
  children,
  variant = 'slideUp',
  gestureEnabled = true
}: AnimatedPageProps) {
  const router = useRouter();
  const controls = useAnimationControls();
  const shouldReduceMotion = useReducedMotion();

  const handleSwipeRight = () => {
    if (gestureEnabled) {
      controls.start({ x: '100%', opacity: 0 });
      setTimeout(() => router.back(), 200);
    }
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : pageTransitions[variant].initial}
      animate={shouldReduceMotion ? { opacity: 1 } : pageTransitions[variant].animate}
      exit={shouldReduceMotion ? { opacity: 0 } : pageTransitions[variant].exit}
      transition={springConfigs.smooth}
      drag={gestureEnabled && !shouldReduceMotion ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.x > 100 && velocity.x > 200) {
          handleSwipeRight();
        }
      }}
      style={{ width: '100%', minHeight: '100vh' }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatedPage };
