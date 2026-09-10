// src/features/pays/registry/paysSectionRegistry.ts
// Source unique de vérité des 4 sections prioritaires de la page Pays.
// La sidebar, les onglets mobile, les hooks et les tests lisent TOUS ce registre.
import type { PaysSectionDef, PaysSectionId } from '../types';

export const PAYS_SECTIONS: readonly PaysSectionDef[] = [
  {
    id: 'presentation',
    label: 'Présentation',
    eyebrow: 'VUE D’ENSEMBLE',
    title: 'Présentation',
    subtitle: 'L’essentiel du pays en un regard',
    blockTypes: ['vue_ensemble'],
  },
  {
    id: 'destinations',
    label: 'Destinations',
    eyebrow: 'OÙ ALLER',
    title: 'Destinations',
    subtitle: 'Zones, villes et lieux incontournables',
    blockTypes: ['spots_incontournables'],
    partner: 'viator',
  },
  {
    id: 'activites',
    label: 'Activités & Treks',
    eyebrow: 'EXPÉRIENCES & OUTDOOR',
    title: 'Activités & Treks',
    subtitle: 'Treks, randonnées et expériences',
    blockTypes: ['itineraires_suggeres', 'niveau_difficulte', 'meilleure_periode_activite'],
    partner: 'viator',
  },
  {
    id: 'culture',
    label: 'Culture & Société',
    eyebrow: 'CULTURE & SOCIÉTÉ',
    title: 'Culture & Société',
    subtitle: 'Usages, traditions et savoir-vivre',
    blockTypes: ['etiquette'],
  },
] as const;

export function getPaysSection(id: PaysSectionId): PaysSectionDef {
  const def = PAYS_SECTIONS.find((section) => section.id === id);
  if (!def) {
    // Ne devrait jamais arriver (id typé), mais évite un crash runtime.
    return PAYS_SECTIONS[0];
  }
  return def;
}
