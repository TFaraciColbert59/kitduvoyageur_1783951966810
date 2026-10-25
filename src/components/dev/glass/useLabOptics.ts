'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Read canonical tokens; numerical adapters are restricted to the lab. */
export function useLabOptics() {
  const ref = useRef<HTMLDivElement>(null);
  const [optics, setOptics] = useState({ radius: 0, blur: 0, saturation: 1, ready: false });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const computed = getComputedStyle(ref.current);
    const saturation = computed.getPropertyValue('--glass-sat').trim();
    setOptics({
      radius: parseFloat(computed.borderTopLeftRadius) || 0,
      blur: parseFloat(computed.getPropertyValue('--glass-blur-md')) || 0,
      saturation: (parseFloat(saturation) || 1) / (saturation.endsWith('%') ? 100 : 1),
      ready: true,
    });
  }, []);
  return { ref, optics };
}
