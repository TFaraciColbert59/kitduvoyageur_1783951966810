'use client';

import { useEffect, useState } from 'react';
import type { GlassCapabilities } from './glassLabPolicy';

type HintedNavigator = Navigator & {
  deviceMemory?: number;
  connection?: EventTarget & { saveData?: boolean };
};

export function useGlassCapabilities(forceStandard: boolean): GlassCapabilities {
  const [capabilities, setCapabilities] = useState<GlassCapabilities>({ ready: false, backdropFilter: false });
  useEffect(() => {
    const device = navigator as HintedNavigator;
    const queries = [
      matchMedia('(prefers-reduced-motion: reduce)'),
      matchMedia('(prefers-reduced-transparency: reduce)'),
      matchMedia('(prefers-contrast: more)'),
      matchMedia('(forced-colors: active)'),
    ];
    const update = () => setCapabilities({
      ready: true,
      backdropFilter: CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
      reducedMotion: queries[0].matches,
      reducedTransparency: queries[1].matches,
      increasedContrast: queries[2].matches,
      forcedColors: queries[3].matches,
      saveData: device.connection?.saveData,
      hardwareConcurrency: device.hardwareConcurrency,
      deviceMemory: device.deviceMemory,
      forceStandard: forceStandard || document.documentElement.dataset.glassEffects === 'reduced',
    });
    update();
    queries.forEach(query => query.addEventListener('change', update));
    device.connection?.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-glass-effects'] });
    return () => {
      queries.forEach(query => query.removeEventListener('change', update));
      device.connection?.removeEventListener('change', update);
      observer.disconnect();
    };
  }, [forceStandard]);
  return capabilities;
}
