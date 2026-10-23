import type {
  CompteMapMode,
  CompteMapSheet,
  MapModeConfig,
  MapTrack,
} from './types';

const CONFIG: Record<CompteMapMode, MapModeConfig> = {
  overview: {
    mode: 'overview',
    label: 'Ta carte',
    emptyTitle: 'Ta carte se dessine à ta première sortie.',
    emptyHint: 'Enregistre une sortie pour voir ta trace, tes massifs et tes kilomètres.',
    emptyCta: { label: 'Enregistrer une sortie', href: '/compas' },
    camera: 'fit-all',
    layers: { tracks: 'all', massifs: true, carnets: true, pois: true, outingPins: true },
    hud: 'full',
    dimmed: false,
  },
  vitrine: {
    mode: 'vitrine',
    label: 'Vitrine',
    emptyTitle: 'Aucune sortie publiée.',
    emptyHint: 'Tes statistiques apparaîtront ici dès ta première sortie.',
    emptyCta: { label: 'Enregistrer une sortie', href: '/compas' },
    camera: 'fit-all',
    layers: { tracks: 'all', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'full',
    dimmed: false,
  },
  kit: {
    mode: 'kit',
    label: 'Kit',
    emptyTitle: 'Aucune sortie liée à un kit.',
    emptyHint: 'Une sortie apparaît ici quand tu lui associes un kit réel.',
    emptyCta: { label: 'Voir mes kits', action: 'open-kits' },
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  prets: {
    mode: 'prets',
    label: 'Prêts',
    emptyTitle: 'Les prêts n’ont pas de position.',
    emptyHint: 'Les lieux de vie ne sont jamais publiés. Retrouve chaque prêt dans le drawer.',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  souvenirs: {
    mode: 'souvenirs',
    label: 'Souvenirs',
    emptyTitle: 'Aucun souvenir géolocalisé.',
    emptyHint: 'Les sorties avec une trace GPS et les carnets liés apparaîtront ici.',
    emptyCta: null,
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: true, pois: true, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  communaute: {
    mode: 'communaute',
    label: 'Communauté',
    emptyTitle: 'Aucune sortie partagée géolocalisée.',
    emptyHint: 'Les sorties avec au moins un compagnon réel apparaîtront ici.',
    emptyCta: null,
    camera: 'fit-filtered',
    layers: { tracks: 'filtered', massifs: true, carnets: false, pois: false, outingPins: true },
    hud: 'count',
    dimmed: false,
  },
  compte: {
    mode: 'compte',
    label: 'Compte',
    emptyTitle: '',
    emptyHint: '',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  reseau: {
    mode: 'reseau',
    label: 'Réseau',
    emptyTitle: 'Le réseau n’est pas une carte.',
    emptyHint: 'Aucune position de tes relations n’est exposée.',
    emptyCta: null,
    camera: 'keep',
    layers: { tracks: 'none', massifs: false, carnets: false, pois: false, outingPins: false },
    hud: 'none',
    dimmed: true,
  },
  sortie: {
    mode: 'sortie',
    label: 'Sortie',
    emptyTitle: 'Trace GPS non enregistrée pour cette sortie.',
    emptyHint: 'La sortie existe, mais aucun point GPS n’est disponible.',
    emptyCta: null,
    camera: 'fit-selected',
    layers: { tracks: 'selected', massifs: false, carnets: false, pois: true, outingPins: true },
    hud: 'outing',
    dimmed: false,
  },
};

export function mapModeConfig(mode: CompteMapMode): MapModeConfig {
  return CONFIG[mode] ?? CONFIG.overview;
}

export function resolveSheetMode(sheet: CompteMapSheet): CompteMapMode {
  if (!sheet.kind) return 'overview';
  if (sheet.kind === 'step' && sheet.step === 0) {
    const slot = sheet.slot as CompteMapMode | null;
    return slot && slot in CONFIG ? slot : 'vitrine';
  }
  if (sheet.kind === 'account_drawer') return 'compte';
  if (sheet.kind === 'followers_sheet') return 'reseau';
  if (sheet.kind === 'outing_drawer') return 'sortie';
  return 'overview';
}

export function filterTracksForMode(
  tracks: MapTrack[],
  mode: CompteMapMode,
  selectedId?: string | null
): MapTrack[] {
  const config = mapModeConfig(mode);
  if (config.layers.tracks === 'none') return [];
  if (config.layers.tracks === 'selected') {
    return tracks.filter((track) => track.id === selectedId);
  }
  if (config.layers.tracks === 'filtered') {
    if (mode === 'kit') return tracks.filter((track) => Boolean(track.kitId));
    if (mode === 'communaute') return tracks.filter((track) => track.participantsCount > 0);
  }
  return tracks;
}
