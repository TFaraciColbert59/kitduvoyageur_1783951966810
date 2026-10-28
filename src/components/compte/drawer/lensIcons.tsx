import React from 'react';
import { lkdvIcon } from '@/components/ui/lkdvIconComponent';

/**
 * Icônes des lentilles du drawer Profil.
 *
 * Même vocabulaire que les icônes de la barre d’onglets et de la carte :
 * traits fins, bouts arrondis, 18 px. Les glyphes sont ceux de Lucide (jeu
 * d’icônes open source au trait, très proche du langage d’Instagram).
 */
const icon = (Glyph: React.ComponentType<{ size?: number; strokeWidth?: number }>) => (
  <Glyph size={18} strokeWidth={1.8} />
);

export const LENS_ICONS: Record<string, React.ReactNode> = {
  stats: icon(lkdvIcon('denivele')),
  repost: icon(lkdvIcon('actualiser')),
  badges: icon(lkdvIcon('recompense')),
  kits: icon(lkdvIcon('sac')),
  inventory: icon(lkdvIcon('liste_materiel')),
  lender: icon(lkdvIcon('exporter')),
  borrower: icon(lkdvIcon('telecharger')),
  trust: icon(lkdvIcon('securite')),
  timeline: icon(lkdvIcon('historique')),
  passport: icon(lkdvIcon('preparateur')),
  souvenirs: icon(lkdvIcon('photo')),
  challenges: icon(lkdvIcon('signalement')),
  clubs: icon(lkdvIcon('communaute')),
  cordee: icon(lkdvIcon('lien')),
};
