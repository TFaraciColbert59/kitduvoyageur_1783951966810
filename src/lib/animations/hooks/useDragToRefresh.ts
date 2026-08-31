'use client';
import { useState } from 'react';
import { useAnimationControls } from 'framer-motion';

export function useDragToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controls = useAnimationControls();

  const handleDragEnd = async (e: any, { offset, velocity }: any) => {
    if (offset.y > 80 && velocity.y > 200) {
      setIsRefreshing(true);
      await controls.start({ y: 60 });
      await onRefresh();
      await controls.start({ y: 0 });
      setIsRefreshing(false);
    }
  };

  return { isRefreshing, controls, handleDragEnd };
}
