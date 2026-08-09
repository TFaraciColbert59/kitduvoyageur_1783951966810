import { useScroll, useTransform } from 'framer-motion';

export function useParallax(speed = 0.5) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, 1000 * speed]);

  return y;
}
