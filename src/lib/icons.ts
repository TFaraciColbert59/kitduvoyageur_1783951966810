
import { lkdvIcon, type LKDVIconComponent } from '@/components/ui/lkdvIconComponent';

export const SEMANTIC_ICONS = {
  // Navigation & Structure
  home: lkdvIcon('accueil'),
  compass: lkdvIcon('boussole'),
  mountain: lkdvIcon('montagne'),
  mapPin: lkdvIcon('point_interet'),
  calendar: lkdvIcon('calendrier'),
  clock: lkdvIcon('duree'),
  search: lkdvIcon('recherche'),
  filter: lkdvIcon('filtres'),
  
  // Expeditions & Team
  users: lkdvIcon('communaute'),
  gear: lkdvIcon('inventaire'),
  safety: lkdvIcon('securite'),
  budget: lkdvIcon('paiement'),
  document: lkdvIcon('facture'),
  tent: lkdvIcon('tente'),
  sparkles: lkdvIcon('ia'),
  shop: lkdvIcon('boutique'),

  // Status & Feedback
  success: lkdvIcon('valider'),
  warning: lkdvIcon('alerte'),
  error: lkdvIcon('annuler'),
  info: lkdvIcon('informations'),
  check: lkdvIcon('valider'),
  close: lkdvIcon('fermer'),
  lock: lkdvIcon('verrou'),
  heart: lkdvIcon('favoris'),
  bookmark: lkdvIcon('signet'),
  bell: lkdvIcon('notifications'),

  // Actions
  plus: lkdvIcon('plus'),
  trash: lkdvIcon('supprimer'),
  edit: lkdvIcon('modifier'),
  share: lkdvIcon('partager'),
  download: lkdvIcon('telecharger'),
  print: lkdvIcon('exporter'),
  trendUp: lkdvIcon('denivele'),
  trendDown: lkdvIcon('denivele'),

  // Chevrons & Direction
  chevronDown: lkdvIcon('bas'),
  chevronUp: lkdvIcon('haut'),
  chevronLeft: lkdvIcon('retour'),
  chevronRight: lkdvIcon('suivant'),
  arrowRight: lkdvIcon('suivant'),
  arrowLeft: lkdvIcon('retour'),
} as const;

export type SemanticIconName = keyof typeof SEMANTIC_ICONS;

/**
 * Récupère l'icône LKDV V2 standard pour un nom sémantique.
 */
export function getSemanticIcon(name: SemanticIconName): LKDVIconComponent {
  return SEMANTIC_ICONS[name] || lkdvIcon('boussole');
}
