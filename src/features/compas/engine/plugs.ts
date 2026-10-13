/**
 * Compas — prises, tension et fréquence du courant (PLAN-100 4.2). Module PUR : une table datée et sourcée,
 * des comparaisons ; aucun réseau, aucune heure du système.
 *
 * SOURCE (`data/mainsElectricity.json`, `scripts/compas/build-mains-electricity.mjs`) : tableau « Mains
 * electricity by country » de Wikipédia (révision 1379647853, CC BY-SA 4.0), dont les lettres de prise
 * (A à O) viennent de l'ancien site « World Plugs » de la CEI, retiré par elle en septembre 2026. 228 pays et
 * territoires ; ceux que le tableau ne donne pas (Mayotte, Wallis-et-Futuna, Saint-Barthélemy, Soudan du Sud,
 * Vatican…) n'ont ni prise ni tension : rien n'est dit pour eux.
 *
 * QUI REGARDE : « adaptateur à prévoir » dépend des appareils de la personne, donc de son pays de résidence ;
 * il se calcule à la LECTURE, jamais à l'écriture (le voyage est lisible par les collaborateurs : voir
 * `papers.ts`). Ce module reçoit un pays de résidence ; il ne lit aucun profil.
 *
 * Ce que le calcul affirme, et ce qu'il ne dit pas :
 *  - « adaptateur à prévoir » : aucune lettre de prise en commun entre les appareils (pays de résidence) et le pays
 *    visité. Les lettres que les notes de l'article disent historiques, très rares ou sans prise sur place
 *    (`rare` : D et M du Royaume-Uni, C à Singapour et en Malaisie…) ne comptent pas, et D et M ne comptent
 *    jamais comme « en commun » (grosses fiches de 5 et 15 A, listées aussi à Hong Kong et Macao) : on préfère
 *    prévenir à tort que se taire à tort ;
 *  - une lettre en commun ne prouve pas que toutes les prises du pays reçoivent vos fiches : alors on ne dit
 *    rien (comme avant pour la France), pas « aucun adaptateur nécessaire » ;
 *  - sans résidence connue, le fait du pays seul, et seulement là où la table ne donne pas le type C (la
 *    fiche à deux broches des appareils d'Europe continentale, reçue par la plupart des prises du monde) ;
 *  - tension et fréquence : une ligne « Courant » quand les deux pays sont connus et que le pays visité a une
 *    tension du foyer d'un autre ordre (moins de 160 V contre au moins 160 V) ou une fréquence absente de chez
 *    toi. La table donne la tension nominale du réseau, pas ce que supporte chaque appareil : la ligne renvoie
 *    à l'inscription du bloc d'alimentation.
 */

import MAINS from '../data/mainsElectricity.json';

export interface MainsRow {
  /** Lettres de prise (A à O) du tableau, dans son ordre. */
  plugs: string[];
  /** Lettres que les notes de l'article disent historiques, très rares, à usage particulier ou sans prise sur place. */
  rare?: string[];
  /** Tensions du foyer en volts (premier nombre de chaque « A/B V »), croissantes. */
  volts: number[];
  /** Fréquences en hertz (50, 60). */
  hz: number[];
}

const TABLE = MAINS as unknown as Record<string, MainsRow>;

const normal = (code: string | null | undefined) => (code ?? '').trim().toUpperCase();

/** La ligne du pays visité ; null si la table ne le donne pas. */
export function mainsOf(code: string | null | undefined): MainsRow | null {
  return TABLE[normal(code)] ?? null;
}

/** Territoires français que la table ne donne pas : leurs résidents ont des appareils de France. */
const FRENCH_WITHOUT_ROW = new Set(['YT', 'BL', 'WF']);

/**
 * La ligne des appareils d'un résident : son pays, sinon la France pour un territoire français que la table ne
 * donne pas, sinon null (aucune affirmation).
 */
export function devicesOf(residence: string | null | undefined): MainsRow | null {
  const code = normal(residence);
  return TABLE[code] ?? (FRENCH_WITHOUT_ROW.has(code) ? (TABLE.FR ?? null) : null);
}

/** Les lettres en usage : celles du tableau sans les `rare` (sauf si cela ne laisse rien). */
export function usualPlugs(row: MainsRow): string[] {
  const rare = new Set(row.rare ?? []);
  const kept = row.plugs.filter((p) => !rare.has(p));
  return kept.length ? kept : row.plugs;
}

/** Jamais « en commun » : fiches de 5 et 15 A, historiques au Royaume-Uni et à Hong Kong. */
const NEVER_SHARED = new Set(['D', 'M']);

/** Les lettres de prise en commun entre les appareils et le pays visité. */
export function sharedPlugs(devices: MainsRow, destination: MainsRow): string[] {
  const dest = new Set(usualPlugs(destination));
  return usualPlugs(devices).filter((p) => dest.has(p) && !NEVER_SHARED.has(p));
}

const types = (row: MainsRow) => usualPlugs(row).join('/');

/**
 * La ligne « Prises » du fait du pays, sans profil : seulement là où la table ne donne pas le type C. Pays inconnu
 * de la table, ou avec C : null.
 */
export function plugFact(country: string, where: string): string | null {
  const row = mainsOf(country);
  if (!row || usualPlugs(row).includes('C')) return null;
  return `Prises de type ${types(row)} (${where}) : vérifie que tes chargeurs s’y branchent.`;
}

/** Ce que les appareils d'un résident disent des prises du pays visité. */
export type PlugVerdict =
  /** Pays visité inconnu de la table : rien à dire. */
  | { kind: 'rien' }
  /** Résidence inconnue de la table : seulement le fait du pays. */
  | { kind: 'fait'; line: string | null }
  /** Au moins une lettre en commun : rien à dire (pas une garantie). */
  | { kind: 'commun'; shared: string[] }
  /** Aucune lettre en commun. */
  | { kind: 'adaptateur'; line: string };

/**
 * La comparaison des appareils d'un résident (`residence`) et du pays visité (`country`). `where` : le nom du pays
 * tel que la ligne le dit.
 */
export function plugVerdict(
  country: string | null | undefined,
  where: string,
  residence: string | null | undefined
): PlugVerdict {
  const to = mainsOf(country);
  if (!to) return { kind: 'rien' };
  // Son propre pays : ses appareils y vont (comme une prise en commun), rien à dire.
  if (normal(residence) === normal(country)) return { kind: 'commun', shared: usualPlugs(to) };
  const from = devicesOf(residence);
  if (!from) return { kind: 'fait', line: plugFact(normal(country), where) };
  const shared = sharedPlugs(from, to);
  if (shared.length) return { kind: 'commun', shared };
  return { kind: 'adaptateur', line: `Prises de type ${types(to)} : adaptateur à prévoir.` };
}

/** La ligne « Prises » de ce résident (null : rien à dire). */
export function plugLineFor(
  country: string | null | undefined,
  where: string,
  residence: string | null | undefined
): string | null {
  const v = plugVerdict(country, where, residence);
  return v.kind === 'fait' ? v.line : v.kind === 'adaptateur' ? v.line : null;
}

/* ---------- Tension et fréquence ---------- */

/** En dessous : le foyer est en 100 à 127 V (Amériques, Japon…) ; au-dessus, en 200 à 240 V. */
const LOW_VOLT_BELOW = 160;

const volt = (v: number) => (v < LOW_VOLT_BELOW ? 'low' : 'high');

function listed(values: number[], unit: string): string {
  if (values.length === 1) return `${values[0]} ${unit}`;
  return `${values.slice(0, -1).join(', ')} ou ${values[values.length - 1]} ${unit}`;
}

/** « 120 V · 60 Hz », « 100, 200 ou 210 V · 50 ou 60 Hz ». */
export function describeCurrent(row: MainsRow): string {
  return `${listed(row.volts, 'V')} · ${row.hz.length === 1 ? `${row.hz[0]} Hz` : `${row.hz.join(' ou ')} Hz`}`;
}

/** Le pays visité a une tension d'un autre ordre, ou une fréquence, que chez la personne ? */
export function currentDiffers(devices: MainsRow, destination: MainsRow): boolean {
  const homeVolts = new Set(devices.volts.map(volt));
  const otherVolt = destination.volts.some((v) => !homeVolts.has(volt(v)));
  const otherHz = destination.hz.some((f) => !devices.hz.includes(f));
  return otherVolt || otherHz;
}

/** Préfixe de la ligne de courant (aussi lu par `papers.ts` pour retirer une ligne rangée par erreur). */
export const CURRENT_NOTE_PREFIX = 'Courant :';

/**
 * La ligne « Courant » de ce résident : seulement si la table donne les deux pays et que le courant diffère.
 * Null sinon (y compris résidence inconnue : le fait du pays seul n'est pas un conseil).
 */
export function currentLineFor(
  country: string | null | undefined,
  residence: string | null | undefined
): string | null {
  const to = mainsOf(country);
  const from = devicesOf(residence);
  if (!to || !from || normal(residence) === normal(country)) return null;
  if (!currentDiffers(from, to)) return null;
  return `${CURRENT_NOTE_PREFIX} ${describeCurrent(to)} sur place (chez toi : ${describeCurrent(from)}) ; vérifie sur le bloc d’alimentation de chaque appareil qu’il l’accepte.`;
}
