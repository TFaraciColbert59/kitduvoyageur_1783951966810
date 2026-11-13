/**
 * Registre des fonds topographiques **nationaux officiels** (fiche K3.05).
 *
 * Règle de la fiche : « Accès, licence ou arbitrage à valider. Consigner la
 * décision et la disponibilité avant d'exposer la fonction. » Ce registre est
 * donc volontairement séparé du sélecteur Relief / Satellite / Plan :
 *
 * - `verified`   : source officielle, accès et couverture confirmés → peut
 *                  devenir un fond sélectionnable ;
 * - `unverified` : source officielle documentée, mais accès non confirmé dans
 *                  l'environnement → affichée comme information, aucune tuile
 *                  n'est chargée et aucun bouton ne l'active.
 *
 * Aujourd'hui seule la France dispose d'une source documentée dans le dépôt
 * (`docs/analysis/DATA_SOURCES.md`, licence Etalab 2.0). Elle reste
 * `unverified` : le registre d'exigences du chantier C01 marque
 * `TOPO_NATIONALE` comme `non_confirme`.
 */

export interface NationalTopoSource {
  /** Identifiant stable, utilisé par MapStage si la source est activée. */
  id: string;
  /** Pays couvert, code ISO 3166-1 alpha-2. */
  iso: string;
  label: string;
  provider: string;
  licence: string;
  attribution: string;
  /** Modèle WMTS/raster, sans clé. */
  tiles: string[];
  maxzoom: number;
  tileSize: 256 | 512;
  status: 'verified' | 'unverified';
  /** Pourquoi la source n'est pas encore activable. */
  note: string;
  sourceUrl: string;
}

/**
 * Sources documentées. Aucune autre source nationale n'est déclarée : la
 * couverture « par pays » reste donc honnêtement vide pour les autres pays.
 */
export const NATIONAL_TOPO_SOURCES: readonly NationalTopoSource[] = [
  {
    id: 'fr-ign-plan-v2',
    iso: 'FR',
    label: 'Plan IGN v2',
    provider: 'IGN',
    licence: 'Licence Ouverte Etalab 2.0',
    attribution: 'IGN — 2024',
    tiles: [
      // URL déjà présente dans `public/demo-lkdv-3d.html` ; elle n'est pas
      // appelée tant que le statut reste `unverified`.
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    ],
    maxzoom: 18,
    tileSize: 256,
    status: 'unverified',
    note: 'Accès, couverture et conditions de charge à confirmer avant activation.',
    sourceUrl: 'https://www.ign.fr/',
  },
];

/** Sources déclarées pour un pays (vérifiées ou non). */
export function nationalTopoSourcesFor(iso: string | null | undefined): NationalTopoSource[] {
  const clean = typeof iso === 'string' ? iso.trim().toUpperCase() : '';
  if (clean.length !== 2) return [];
  return NATIONAL_TOPO_SOURCES.filter((source) => source.iso === clean);
}

/** Première source réellement activable pour ce pays, sinon `null`. */
export function verifiedNationalTopoFor(
  iso: string | null | undefined,
): NationalTopoSource | null {
  return nationalTopoSourcesFor(iso).find((source) => source.status === 'verified') ?? null;
}
