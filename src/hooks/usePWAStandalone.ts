import { useState, useEffect } from 'react';

export function usePWAStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const mqStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // iOS Safari — navigator.standalone is not in standard TS types
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const iosStandalone = nav.standalone === true;
      setIsStandalone(mqStandalone || iosStandalone);
    };

    checkStandalone();

    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', checkStandalone);
    return () => mq.removeEventListener('change', checkStandalone);
  }, []);

  return isStandalone;
}
