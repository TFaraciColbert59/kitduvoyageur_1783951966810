/**
 * Catalogue déclaratif des repères de découverte passive LKDV.
 *
 * Chaque repère cible un contrôle réel via `data-discover="<id>"` (sans
 * wrapper invasif) et reste strictement limité à un titre court + 1–2 lignes
 * max, accompagné d'une mini-animation SVG dédiée.
 */

export type DiscoverySurface =
  | 'explorer'
  | 'communaute'
  | 'hub'
  | 'carnets'
  | 'clubs'
  | 'messagerie'
  | 'kit-studio'
  | 'compte';

export type DiscoveryVisualKind =
  | 'route-draw'
  | 'gps-pulse'
  | 'map-layers'
  | 'bookmark-gpx'
  | 'create-plus'
  | 'stories-swipe'
  | 'reels-doubletap'
  | 'hub-hold'
  | 'carnet-log'
  | 'messages-share'
  | 'kit-pack'
  | 'compte-gear'
  | 'club-pulse';

export interface DiscoveryStep {
  readonly id: string;
  readonly surface: DiscoverySurface;
  /** Ordre strict dans la timeline de la surface (1 seul actif à la fois). */
  readonly order: number;
  /** Valeur attendue dans l'attribut `data-discover="..."` sur l'élément cible. */
  readonly anchor: string;
  /** Titre ultra-court (2–4 mots). */
  readonly title: string;
  /** Explication concise (1–2 lignes max, jamais de mur de texte). */
  readonly body: string;
  /** Animation SVG miniature affichée dans la pilule haute. */
  readonly visual: DiscoveryVisualKind;
  /** Durée avant repli doux automatique (ms). */
  readonly durationMs?: number;
}

export const DISCOVERY_STEPS: readonly DiscoveryStep[] = [
  // ── EXPLORER (/explorer) ──────────────────────────────────────────────────
  {
    id: 'explorer-planner',
    surface: 'explorer',
    order: 1,
    anchor: 'explorer-planner',
    title: 'Trace ton itinéraire',
    body: 'Pose tes points sur la carte 3D et calcule distance & D+.',
    visual: 'route-draw',
    durationMs: 7200,
  },
  {
    id: 'explorer-play',
    surface: 'explorer',
    order: 2,
    anchor: 'explorer-play',
    title: 'Lance une sortie GPS',
    body: 'Enregistre ta trace offline avec suivi en direct et analyse.',
    visual: 'gps-pulse',
    durationMs: 6800,
  },
  {
    id: 'explorer-layers',
    surface: 'explorer',
    order: 3,
    anchor: 'explorer-layers',
    title: 'Fonds & couches 3D',
    body: 'Passe en topo, satellite ou relief en un tap.',
    visual: 'map-layers',
    durationMs: 6400,
  },
  {
    id: 'explorer-saved',
    surface: 'explorer',
    order: 4,
    anchor: 'explorer-saved',
    title: 'Lieux & import GPX',
    body: 'Retrouve tes favoris et importe tes traces GPX.',
    visual: 'bookmark-gpx',
    durationMs: 6400,
  },

  // ── COMMUNAUTÉ (/communaute) ──────────────────────────────────────────────
  {
    id: 'community-create',
    surface: 'communaute',
    order: 1,
    anchor: 'community-create',
    title: 'Publie en un geste',
    body: 'Post, Story, Carnet, Sortie, Kit ou Club au même endroit.',
    visual: 'create-plus',
    durationMs: 7000,
  },
  {
    id: 'community-explore',
    surface: 'communaute',
    order: 2,
    anchor: 'community-explore',
    title: 'Carnets, Clubs & Sorties',
    body: 'Explore les aventures et recherches de la communauté.',
    visual: 'stories-swipe',
    durationMs: 6400,
  },
  {
    id: 'community-reels',
    surface: 'communaute',
    order: 3,
    anchor: 'tab-community',
    title: 'Astuce : Freedom Reels',
    body: 'Double-tape cet onglet pour lancer les vidéos plein écran.',
    visual: 'reels-doubletap',
    durationMs: 6800,
  },

  // ── HUB (/hub) ────────────────────────────────────────────────────────────
  {
    id: 'hub-switcher',
    surface: 'hub',
    order: 1,
    anchor: 'tab-adventures',
    title: 'Changer d’aventure',
    body: 'Maintiens cet onglet pour basculer entre tes voyages.',
    visual: 'hub-hold',
    durationMs: 6800,
  },

  // ── CARNETS (/carnets/[id]) ───────────────────────────────────────────────
  {
    id: 'carnet-add',
    surface: 'carnets',
    order: 1,
    anchor: 'carnet-add',
    title: 'Enrichis ton carnet',
    body: 'Ajoute une étape, une photo ou un récit sur place.',
    visual: 'carnet-log',
    durationMs: 6800,
  },
  {
    id: 'carnet-menu',
    surface: 'carnets',
    order: 2,
    anchor: 'carnet-title',
    title: 'Options du carnet',
    body: 'Partage, réglages et mode d’affichage accessibles ici.',
    visual: 'stories-swipe',
    durationMs: 6400,
  },

  // ── CLUBS (/clubs/[id]) ───────────────────────────────────────────────────
  {
    id: 'club-tabs',
    surface: 'clubs',
    order: 1,
    anchor: 'club-tabs',
    title: 'La vie du club',
    body: 'Fil, sorties collectives, coffre matériel et salons.',
    visual: 'club-pulse',
    durationMs: 6800,
  },

  // ── MESSAGERIE (/messagerie) ──────────────────────────────────────────────
  {
    id: 'messages-compose',
    surface: 'messagerie',
    order: 1,
    anchor: 'messages-compose',
    title: 'Partage sur le terrain',
    body: 'Envoie traces GPX, posts et fiches matériel en direct.',
    visual: 'messages-share',
    durationMs: 6800,
  },

  // ── KIT STUDIO (/kit-studio) ──────────────────────────────────────────────
  {
    id: 'kit-studio-bag',
    surface: 'kit-studio',
    order: 1,
    anchor: 'kit-studio-bag',
    title: 'Ton sac au gramme près',
    body: 'Compose ton kit 3D et vérifie poids & checklists.',
    visual: 'kit-pack',
    durationMs: 6800,
  },

  // ── COMPTE (/compte) ──────────────────────────────────────────────────────
  {
    id: 'compte-settings',
    surface: 'compte',
    order: 1,
    anchor: 'tab-me',
    title: 'Capteurs, montres & XP',
    body: 'Retrouve tes sorties, zones cardio et suivi live ici.',
    visual: 'compte-gear',
    durationMs: 6400,
  },
];

/** Résout la surface active à partir d'un pathname Next.js. */
export function resolveDiscoverySurface(pathname: string | null | undefined): DiscoverySurface | null {
  if (!pathname) return null;
  if (pathname === '/explorer' || pathname.startsWith('/explorer/')) return 'explorer';
  if (pathname === '/communaute' || pathname.startsWith('/communaute/')) return 'communaute';
  if (pathname === '/hub' || pathname.startsWith('/hub/')) return 'hub';
  if (pathname.startsWith('/carnets/')) return 'carnets';
  if (pathname.startsWith('/clubs/')) return 'clubs';
  if (pathname === '/messagerie' || pathname.startsWith('/messagerie/')) return 'messagerie';
  if (pathname === '/kit-studio' || pathname.startsWith('/kit-studio/')) return 'kit-studio';
  if (pathname === '/compte' || pathname.startsWith('/compte/')) return 'compte';
  return null;
}

/** Retourne les repères d'une surface triés par ordre strict. */
export function getStepsForSurface(surface: DiscoverySurface): DiscoveryStep[] {
  return DISCOVERY_STEPS.filter((step) => step.surface === surface).sort(
    (a, b) => a.order - b.order,
  );
}

/** Trouve un repère par son identifiant. */
export function getDiscoveryStepById(id: string | null | undefined): DiscoveryStep | null {
  if (!id) return null;
  return DISCOVERY_STEPS.find((step) => step.id === id) ?? null;
}
