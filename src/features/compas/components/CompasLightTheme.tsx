'use client';

import { useEffect } from 'react';

/** Le thème que l'app appliquerait hors du Compas (même règle que lkdv-theme-init). */
function preferredDark(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem('lkdv_theme');
  } catch {
    /* stockage indisponible : préférence système */
  }
  return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(dark: boolean) {
  const r = document.documentElement;
  r.classList.toggle('dark', dark);
  r.setAttribute('data-theme', dark ? 'dark' : 'light');
  r.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * La maquette finale du Compas est claire uniquement : sur /compas (création
 * comprise), le thème clair est forcé, même si le téléphone est en sombre.
 * Le script d'initialisation le fait avant la peinture pour une arrivée
 * directe ; ce composant couvre la navigation dans l'app et rend la
 * préférence de la personne en quittant le Compas.
 */
export function CompasLightTheme() {
  useEffect(() => {
    apply(false);
    return () => apply(preferredDark());
  }, []);
  return null;
}
