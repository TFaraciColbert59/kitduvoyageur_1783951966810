'use client';

import LiquidGlass from 'liquid-glass-react';
import { useLabOptics } from './useLabOptics';
import styles from './glassLab.module.css';

const stationary = { x: 0, y: 0 };

export default function RdevLayer() {
  const { ref, optics } = useLabOptics();
  return (
    <div ref={ref} className={styles.engineHost} data-optical-engine="rdev">
      {optics.ready && <LiquidGlass
        mode="standard" displacementScale={14} aberrationIntensity={0.25} elasticity={0}
        cornerRadius={optics.radius} blurAmount={Math.max(0, (optics.blur - 4) / 32)}
        saturation={optics.saturation * 100} padding="0"
        globalMousePos={stationary} mouseOffset={stationary}
        style={{ position: 'absolute', width: '100%', height: '100%', top: '50%', left: '50%' }}
      ><span /></LiquidGlass>}
    </div>
  );
}
