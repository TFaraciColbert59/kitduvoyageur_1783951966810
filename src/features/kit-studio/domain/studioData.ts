// Registre runtime des données du studio.
//
// Le domaine lit désormais ses données (objets, kits, catalogue ONE, coloris, configuration,
// pièces possédées/commandées, poids du corps) dans CE registre, et non plus dans les constantes
// de `domain/catalog.ts`. Valeur par défaut : le jeu de démonstration des constantes — c'est ce qui
// garde les tests purs et le mode hors-ligne strictement identiques. En production, la page serveur
// (`src/app/kit-studio/page.tsx`) lit la base via `server/getStudioData.ts` puis le client remplace
// le registre au bootstrap.
//
// Le types des formes reste celui de `domain/catalog.ts` : getStudioData produit *exactement* les
// mêmes formes, seules les valeurs viennent de Supabase. L'identité des objets de données est
// stable (objets des constantes partagés) : c'est ce qui rend le remplacement vérifiable en test.
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from './catalog';
import type { BagId, Colorway, ColorwayId, ConfigSet, Family, Item, Kit, OneSpec } from './catalog';
import type { PieceKey } from './types';

/**
 * Contexte d'écriture serveur, présent seulement quand les données viennent de Supabase.
 * `kitItemByItemId` résout un id d'objet du domaine vers la ligne `materiel_kit_items`
 * correspondante (l'id du domaine est `product_ownership.id` quand la ligne existe).
 */
export interface StudioSyncContext {
  readonly userId: string;
  /** `materiel_kits.id` du kit affiché. */
  readonly kitId: string;
  /** Résolution objet → ligne de kit, pour le kit affiché. */
  readonly kitItemByItemId: Readonly<Record<string, string>>;
  /** Résolution par kit (un compte peut avoir plusieurs kits) : clé = `materiel_kits.id`. */
  readonly kits?: Readonly<Record<string, { readonly kitItemByItemId: Readonly<Record<string, string>> }>>;
}

/** Données du studio, formes identiques aux constantes de démonstration (cf. spec/data-model.md). */
export interface StudioData {
  readonly items: readonly Item[];
  readonly kits: readonly Kit[];
  readonly one: OneSpec;
  readonly colorways: Readonly<Record<ColorwayId, Colorway>>;
  /** Configuration d'apparence par corps de sac (spec : `cfg`). */
  readonly config: Readonly<Record<BagId, ConfigSet>>;
  /** Pièces possédées (spec : `owned`). */
  readonly own: Readonly<Partial<Record<PieceKey, ColorwayId>>>;
  /** Pièces précommandées (spec : `ordered`). */
  readonly order: Readonly<Partial<Record<PieceKey, ColorwayId>>>;
  /** Poids du corps pour l'équilibre (spec : `user.bodyKg`). */
  readonly bodyKg: number;
  /** Libellés de familles (taxonomie, résolus pour l'affichage de la fiche objet). */
  readonly families: readonly Family[];
  /** Présent uniquement en production : cible des écritures serveur. */
  readonly sync?: StudioSyncContext;
}

/** Pièces possédées du jeu de démonstration (maquette OWN l.713 v2), conservé comme fixture. */
const DEMO_OWN: Readonly<Partial<Record<PieceKey, ColorwayId>>> = {
  chassis: 'foret',
  'corps:b42': 'foret',
  'mod:lid': 'foret',
  'mod:front': 'foret',
  'mod:sides': 'foret',
};

/**
 * Jeu de démonstration — source des fixtures de test ET repli hors-ligne quand la base ou la
 * session manque. Ce n'est plus une source de production : aucun écran ne l'utilise quand
 * `getStudioData` a répondu.
 */
export const DEMO_STUDIO_DATA: StudioData = {
  items: ITEMS,
  kits: KITS,
  one: ONE,
  colorways: COLORWAYS,
  config: DEFAULT_CONFIG,
  own: DEMO_OWN,
  order: {},
  bodyKg: 72,
  families: FAMILIES,
};

let active: StudioData = DEMO_STUDIO_DATA;

/** Données actives du studio (démo par défaut, données serveur après bootstrap). */
export function studioData(): StudioData {
  return active;
}

/** Remplace les données actives ; `null` restaure le jeu de démonstration. */
export function setStudioData(data: StudioData | null): void {
  active = data ?? DEMO_STUDIO_DATA;
}

/** Vrai tant qu'aucune donnée serveur n'a remplacé le jeu de démonstration. */
export function isDemoStudioData(): boolean {
  return active === DEMO_STUDIO_DATA;
}

/** Restaure le registre de démonstration (tests, déconnexion, échec de lecture serveur). */
export function resetStudioData(): void {
  active = DEMO_STUDIO_DATA;
}
