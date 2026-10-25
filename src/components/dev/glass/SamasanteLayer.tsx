'use client';

import { Glass } from '@samasante/liquid-glass';
import { useLabOptics } from './useLabOptics';
import styles from './glassLab.module.css';

export default function SamasanteLayer() {
  const { ref, optics } = useLabOptics();
  return (
    <div ref={ref} className={styles.engineHost} data-optical-engine="samasante">
      {optics.ready && <Glass
        optics={{ frost: optics.blur, saturate: optics.saturation, strength: 0.035, dispersion: 0.25, sheen: 0, glow: 0 }}
        radius={optics.radius}
        style={{ width: '100%', height: '100%', background: 'var(--glass-bg-medium)' }}
      ><span /></Glass>}
    </div>
  );
}
