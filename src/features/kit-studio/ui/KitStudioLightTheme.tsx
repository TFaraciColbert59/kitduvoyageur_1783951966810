'use client';

import { useEffect } from 'react';

/** Le thème que l'app appliquerait hors du Kit Studio (même règle que lkdv-theme-init). */
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

/** Le Kit Studio est clair uniquement : thème clair forcé, préférence rendue en quittant l'écran. */
export function KitStudioLightTheme() {
  useEffect(() => {
    apply(false);
    return () => apply(preferredDark());
  }, []);
  return null;
}
