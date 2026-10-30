'use client';

import React, { useEffect, useState } from 'react';

/**
 * Écran de démarrage : le logo LKDV au centre sur le vert forêt de l'app.
 * Rendu côté serveur (visible dès le premier affichage, jamais d'écran blanc),
 * il s'efface en fondu dès que l'app est hydratée.
 */
export function BootScreen() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPhase('leaving'));
    const timer = window.setTimeout(() => setPhase('gone'), 420);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className="lkdv-boot" data-phase={phase} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo local, affiché avant l'hydratation */}
      <img src="/assets/images/lkdv-boot-logo.png" alt="" width={128} height={128} />
    </div>
  );
}

export default BootScreen;
