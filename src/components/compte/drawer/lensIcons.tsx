import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Backpack,
  BarChart3,
  BookOpen,
  Boxes,
  Flag,
  History,
  Image,
  Link2,
  Repeat2,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

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
  stats: icon(BarChart3),
  repost: icon(Repeat2),
  badges: icon(Trophy),
  kits: icon(Backpack),
  inventory: icon(Boxes),
  lender: icon(ArrowUpRight),
  borrower: icon(ArrowDownLeft),
  trust: icon(ShieldCheck),
  timeline: icon(History),
  passport: icon(BookOpen),
  souvenirs: icon(Image),
  challenges: icon(Flag),
  clubs: icon(Users),
  cordee: icon(Link2),
};
