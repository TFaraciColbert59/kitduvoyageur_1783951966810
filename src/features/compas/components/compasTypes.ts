import type { ResaCat } from '../engine/resaCats';
import type { CompasKitLine, CompasStepId } from '../engine/compasModel';
import type { CompasData, CompasShopProduct } from '../server/getCompasData';
import type { Detent } from './CompasSheet';
import { formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { translations } from '@/lib/i18n/translations';
import {
  plural,
  t as translate,
  type TranslationKey,
  type TranslationVars,
} from '@/lib/i18n/translate';

/** Traduction d'une clé du dictionnaire (`useTranslation().t`). */
export type CompasT = (key: TranslationKey, vars?: TranslationVars) => string;

/** Le français par défaut, pour une fonction appelée sans locale (hors React, tests). */
export const FR_T: CompasT = (key, vars) => translate(translations.fr, key, vars);

/** Texte compté : `{count}` formaté selon la locale, forme choisie par Intl.PluralRules. */
export function countText(
  t: CompasT,
  locale: Locale,
  count: number,
  one: TranslationKey,
  other: TranslationKey,
  vars: TranslationVars = {}
): string {
  const all = { ...vars, count: formatNumber(count, {}, locale) };
  return plural(locale, count, { one: t(one, all), other: t(other, all) });
}

export type AcquireMode = 'emprunter' | 'louer' | 'acheter';

/** Un onglet de tiroir : `labelKey` se traduit (`t`), `label` garde le français par défaut. */
const flow = <I extends string>(id: I, labelKey: TranslationKey, icon: string) =>
  ({ id, labelKey, label: FR_T(labelKey), icon }) as const;

/** Parcours internes du tiroir de chaque étape (capsule, comme les étapes). */
export const STEP_FLOWS = {
  // Ordre de la maquette finale : Activité → Parcours → Quand → Préférences
  // → Sac. « Sur place » (points OSM réels : tracé et autour des étapes) suit, en dernier.
  ou: [
    flow('activite', 'compas.flowTabs.activite', 'flag'),
    flow('parcours', 'compas.flowTabs.parcours', 'route'), // i18n-ok : identifiant
    flow('quand', 'compas.flowTabs.quand', 'calendar-days'), // i18n-ok : identifiant
    flow('preferences', 'compas.flowTabs.preferences', 'heart'),
    flow('sac', 'compas.flowTabs.sac', 'backpack'),
    flow('trace', 'compas.flowTabs.trace', 'map-pin'),
  ],
  nous: [
    flow('equipe', 'compas.flowTabs.equipe', 'users'),
    flow('qui', 'compas.flowTabs.qui', 'user-plus'),
    flow('budget', 'compas.flowTabs.budget', 'coins'), // i18n-ok : identifiant
    flow('annonce', 'compas.flowTabs.annonce', 'send'),
  ],
  resa: [
    flow('nuits', 'compas.flowTabs.nuits', 'bed-double'), // i18n-ok : identifiant
    flow('reservations', 'compas.flowTabs.reservations', 'ticket'),
    flow('offres', 'compas.flowTabs.offres', 'tag'),
    flow('etats', 'compas.flowTabs.etats', 'check-check'),
  ],
  // Maquette finale : Risques → Météo → Veille → Sources (la veille suit).
  verdict: [
    flow('raisons', 'compas.flowTabs.raisons', 'shield-check'),
    flow('meteo', 'compas.flowTabs.meteo', 'cloud-sun'),
    flow('veille', 'compas.flowTabs.veille', 'bell'),
    flow('sources', 'compas.flowTabs.sources', 'layers'),
  ],
  kit: [
    flow('conseils', 'compas.flowTabs.conseils', 'sparkles'),
    flow('mes-kits', 'compas.flowTabs.mesKits', 'package'),
    flow('inventaire', 'compas.flowTabs.inventaire', 'archive'),
    flow('trouver', 'compas.flowTabs.trouver', 'search'),
    flow('emballer', 'compas.flowTabs.emballer', 'check-square'),
    flow('tout', 'compas.flowTabs.tout', 'clipboard-list'), // i18n-ok : identifiant
    flow('sacs', 'compas.flowTabs.sacs', 'backpack'),
    flow('eau', 'compas.flowTabs.eau', 'droplet'),
  ],
} as const;

export type StepFlow<S extends CompasStepId = CompasStepId> = (typeof STEP_FLOWS)[S][number]['id'];

export type SheetState =
  | { kind: 'item'; lineId: string }
  | { kind: 'acquire'; lineId: string; mode: AcquireMode }
  | {
      kind: 'add';
      target: 'kit' | 'inventaire';
      /** Venu d'un conseil : recherche pré-remplie et nom proposé pour « Autre ». */
      suggest?: { query: string; name: string };
    }
  | { kind: 'bag'; userId: string }
  | { kind: 'carrier'; lineId: string }
  | { kind: 'step'; step: CompasStepId; flow: StepFlow; hint?: FlowHint };

/** Ce qu'un geste ailleurs (règle, « Dis-le ») transmet au parcours ouvert. */
export interface FlowHint {
  /** Durée choisie sur la règle, en heures, en attente d'un départ. */
  hours?: number;
  /** Lieu à chercher dans Parcours. */
  query?: string;
  /** Jour touché (tuile de nuit) : le tiroir s'ouvre sur ce jour. */
  day?: number;
  /** Phrase tapée dans « Dis-le » sur la carte : le tiroir la comprend aussitôt. */
  say?: string;
  /** La phrase est celle du Compas vide, gardée sur le voyage : effacée une fois appliquée. */
  start?: boolean;
  /** Catégorie touchée sur la carte Résa : Offres s'ouvre filtré dessus. */
  resa?: ResaCat;
}

export type ActionResult = { success: boolean; error?: string };

/** Contrôleur partagé par les cartes et les tiroirs. */
export interface CompasCtl {
  data: CompasData;
  /** Lignes du kit avec l'état « emballé » optimiste appliqué. */
  lines: CompasKitLine[];
  busy: boolean;
  open: (sheet: SheetState, detent?: Detent) => void;
  /** Remplace le tiroir du dessus (changement de parcours interne). */
  replace: (sheet: SheetState) => void;
  back: () => void;
  close: () => void;
  /** Passe le tiroir du dessus en grande hauteur (contenu qui s'allonge). */
  enlarge: () => void;
  /**
   * Exécute une écriture et l'annonce. `undo`, s'il est fourni, rétablit
   * l'état d'avant : « Annuler » apparaît dans l'annonce et Ctrl/⌘+Z le lance.
   */
  run: (
    success: string,
    action: () => Promise<ActionResult>,
    undo?: () => Promise<ActionResult>
  ) => Promise<boolean>;
  togglePacked: (line: CompasKitLine) => void;
  memberName: (userId: string | null) => string;
  product: (id: string | null) => CompasShopProduct | undefined;
  /** Annonce dans l'îlot : un titre, et une ligne de détail facultative. */
  notify: (message: string, tone?: 'bad', sub?: string) => void;
  /** Préremplir le voyage (nuits, trajet, kit, budget) ; absent hors du Compas complet. */
  autofill?: () => void;
  /** Langue de l'écran (`useTranslation`) ; absente : français. */
  t?: CompasT;
  locale?: Locale;
}
