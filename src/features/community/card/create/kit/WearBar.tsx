import React from 'react';

/**
 * Jauge d'usure minimale : le mot « usure » en petit au-dessus d'une barre fine, rien d'autre.
 * La valeur reste lisible par les lecteurs d'écran (`role="meter"`), pas à l'écran.
 */
export function WearBar({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span className="lkdv-kp-wear">
      <small>usure</small>
      <span
        className="lkdv-kp-wear-bar"
        role="meter"
        aria-label="Usure"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <i style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}

export default WearBar;
