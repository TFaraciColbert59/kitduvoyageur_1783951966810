import type { LkvIconName } from '@/components/ui/LkvIcon';
import type { Locale } from '@/lib/i18n/locale';

/**
 * M02 — Registre canonique des destinations principales de la barre mobile.
 *
 * Règles :
 * - 5 destinations, une seule source pour la BottomTabBar et le MobileDrawer ;
 * - `matchPaths` SANS chevauchement : une route n'appartient qu'à une
 *   destination (résolution exacte puis préfixe le plus long) ;
 * - `/groupes` appartient à Aventures : le middleware redirige cette route
 *   vers la surface hub de groupe (src/lib/hub/hubRedirects.ts) ;
 * - labels FR/EN statiques portés par le registre ; le helper
 *   `getDestinationLabel(id, locale)` lit la locale demandée ;
 *
 * Note : `/materiel` est une surface réelle et autonome (plus aucun alias 307
 * vers /hub) ; la destination Matériel ouvre directement cette surface.
 */
export type DestinationId =
  | 'adventures'
  | 'explorer'
  | 'gear'
  | 'community'
  | 'me';

export interface Destination {
  id: DestinationId;
  href: string;
  /** Libellés statiques FR/EN, résolus par `getDestinationLabel`. */
  label: { fr: string; en: string };
  ariaLabel: string;
  iconName: LkvIconName;
  /**
   * Préfixes reconnus. Une route n'appartient qu'à une destination :
   * aucun chemin ne doit apparaître dans deux destinations.
   */
  matchPaths: readonly string[];
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'adventures',
    href: '/hub',
    label: { fr: 'Aventures', en: 'Adventures' },
    ariaLabel:
      'Aventures : aventure active, préparation et voyages',
    iconName: 'tent',
    // /voyages, /groupes, /equipages, /preparation, /terrain, /alertes et
    // /mes-aventures redirigent 307 vers /hub (hubRedirects) : ce sont des
    // alias de la surface Aventures, jamais des surfaces autonomes.
    matchPaths: [
      '/hub',
      '/voyages',
      '/groupes',
      '/equipages',
      '/mes-aventures',
      '/preparation',
      '/terrain',
      '/alertes',
      '/recommandations',
    ],
  },
  {
    id: 'explorer',
    href: '/explorer',
    label: { fr: 'Explorer', en: 'Explore' },
    ariaLabel: 'Explorer les sentiers, pays et destinations',
    iconName: 'compass',
    matchPaths: ['/explorer', '/hors-ligne', '/pays'],
  },
  {
    id: 'gear',
    href: '/materiel',
    label: { fr: 'Matériel', en: 'Gear' },
    ariaLabel: 'Matériel : kit actif et équipement',
    iconName: 'bag',
    matchPaths: ['/materiel'],
  },
  {
    id: 'community',
    href: '/communaute',
    label: { fr: 'Communauté', en: 'Community' },
    ariaLabel: 'Communauté, clubs, événements',
    iconName: 'users',
    matchPaths: [
      '/communaute',
      '/clubs',
      '/carnets',
      '/entraide',
      '/createurs',
      '/experts',
      '/evenements',
      '/feed',
      '/messagerie',
    ],
  },
  {
    id: 'me',
    href: '/compte',
    label: { fr: 'Moi', en: 'Me' },
    ariaLabel: 'Mon compte voyageur et ma progression',
    iconName: 'user',
    matchPaths: ['/compte', '/connexion', '/inscription', '/profil', '/progression'],
  },
] as const;

/** Destination propriétaire d'un href exact (utile pour l'état pressé). */
export function getDestinationByHref(href: string): Destination | null {
  return DESTINATIONS.find((destination) => destination.href === href) ?? null;
}

/**
 * Libellé d'une destination dans la locale demandée. Retourne l'id en repli
 * (jamais d'exception) : aucune structure ni BottomTabBar n'est modifiée.
 */
export function getDestinationLabel(id: DestinationId, locale: Locale): string {
  const destination = DESTINATIONS.find((item) => item.id === id);
  if (!destination) return id;
  return destination.label[locale];
}

/**
 * Phase 2 (Lot 2) — SOURCE UNIQUE du plateau secondaire au-dessus de la barre.
 * Remplace les listes de routes dupliquées entre AppShell et BottomTabBar :
 * toute page qui affiche un plateau de sous-navigation doit être déclarée ici.
 */
const EXTENDED_NAV_PREFIXES: readonly string[] = [
  '/clubs',
  '/carnets',
  '/pays',
  '/communaute',
  '/entraide',
  '/evenements',
  '/messagerie',
  '/voyages',
];

const EXTENDED_NAV_EXCLUSIONS: readonly string[] = ['/carnets/nouveau'];

/** Vrai si la route possède un plateau de navigation secondaire. */
export function hasExtendedNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const isUnder = (prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix + '/');
  if (EXTENDED_NAV_EXCLUSIONS.some(isUnder)) return false;
  return EXTENDED_NAV_PREFIXES.some(isUnder);
}

/**
 * Résout l'unique destination active pour un pathname :
 * correspondance exacte d'abord, puis préfixe le plus long.
 */
export function getActiveDestinationId(
  pathname: string | null | undefined
): DestinationId | null {
  if (!pathname) return null;

  for (const destination of DESTINATIONS) {
    for (const prefix of destination.matchPaths) {
      if (pathname === prefix) return destination.id;
    }
  }

  let bestId: DestinationId | null = null;
  let bestLength = 0;
  for (const destination of DESTINATIONS) {
    for (const prefix of destination.matchPaths) {
      if (pathname.startsWith(prefix + '/') && prefix.length > bestLength) {
        bestId = destination.id;
        bestLength = prefix.length;
      }
    }
  }
  return bestId;
}
