// Blocages, « Prêt à N % » et conseils (moteur pur). Maquette : Kit_Studio_v2.html l.891-905 (activeGhosts, cabinDims, blockers, readiness, tips),
// l.1389-1404 (readyHTML : gain de préparation seulement).
import { BAGS, PACK_ZONE_IDS, ZONE_NAMES } from './catalog';
import type { Ghost, PackZoneId } from './catalog';
import { cog, cogState } from './balance';
import type { CogState } from './balance';
import { formatKg, formatLitres, formatWeight } from './format';
import { frontZ, reindex } from './layout';
import { currentBag, currentConfig, currentKit, getItem } from './state';
import { capOf, effG, effLid, totals } from './totals';
import type { AnyItemId, KitState } from './types';

const NB = ' ';

export type BlockerKind = 'ghost' | 'expired' | 'cabin' | 'dims' | 'cap' | 'cog';
export interface Blocker {
  readonly kind: BlockerKind;
  readonly zone: string;
  readonly gl: string;
  readonly t: string;
  readonly s: string;
  readonly id?: string;
  readonly fn?: string;
}
export interface Tip { readonly t: string; readonly s: string; readonly id: string }
export interface CabinDims { readonly w: number; readonly h: number; readonly d: number }

const packedIds = (s: KitState, z: PackZoneId): readonly AnyItemId[] => currentKit(s).packed[z] ?? [];

/** maquette l.891 : objets « fantômes » (manquants) dont la fonction n'est couverte par aucun objet rangé. */
export function activeGhosts(s: KitState): readonly Ghost[] {
  const k = currentKit(s);
  return (k.ghosts ?? []).filter(
    (g) => !PACK_ZONE_IDS.some((z) => packedIds(s, z).some((id) => getItem(s, id)?.fn === g.fn)),
  );
}

/** maquette l.892 : dimensions du sac en cm (largeur, hauteur, profondeur). */
export function cabinDims(s: KitState): CabinDims {
  const sc = BAGS[currentBag(s).id].sc;
  const c = currentConfig(s);
  const lid = effLid(s);
  const back = c.body.shape === 'slim' ? -0.25 : -0.28;
  const top = c.body.shape === 'roll' ? 0.97 : lid === 'none' ? 0.725 : lid === 'xl' ? 1.07 : 0.99;
  return { w: 0.8 * sc[0] * 44, h: (top + 0.725) * sc[1] * 44, d: (frontZ(s) - back) * sc[2] * 44 };
}

/** maquette l.893-900 : ce qui empêche de partir. Ordre de la maquette ; le verdict d'équilibre est traité à part (cogState). */
export function blockers(s: KitState): Blocker[] {
  const k = currentKit(s);
  const out: Blocker[] = [];
  const t = totals(s);
  for (const g of activeGhosts(s)) {
    out.push({ kind: 'ghost', zone: g.zone, gl: g.gl, fn: g.fn, t: `Manque${NB}: ${g.n.toLowerCase()}`, s: g.why });
  }
  for (const z of PACK_ZONE_IDS) {
    for (const id of packedIds(s, z)) {
      const it = getItem(s, id);
      if (!it) continue;
      if (it.expired) out.push({ kind: 'expired', zone: z, gl: it.gl, id, t: `${it.n} périmée`, s: `Depuis ${it.expired}. À renouveler avant le départ.` });
      if (k.cabin && it.cabinBan) out.push({ kind: 'cabin', zone: z, gl: it.gl, id, t: `${it.n} interdit en cabine`, s: 'À laisser à la maison ou à mettre en soute.' });
    }
  }
  if (k.cabin) {
    const d = cabinDims(s);
    const L = k.cabin.dims;
    if (d.d > L[2]) {
      out.push({ kind: 'dims', zone: 'front', gl: 'bag', t: `Dépasse de ${Math.ceil(d.d - L[2])}${NB}cm en profondeur`, s: `Limite ${L.join(' × ')}${NB}cm. Serre les sangles de compression.` });
    }
    if (t.onBack > k.cabin.kg * 1000) {
      out.push({ kind: 'cap', zone: 'bag', gl: 'bag', t: `Au-dessus de ${k.cabin.kg}${NB}kg`, s: `${formatKg(t.onBack - k.cabin.kg * 1000)} de trop pour la cabine.` });
    }
  }
  for (const z of PACK_ZONE_IDS) {
    if (z === 'worn') continue;
    const cap = capOf(s, z);
    const v = t.volumeByZone[z] ?? 0;
    if (v > cap + 0.05) out.push({ kind: 'cap', zone: z, gl: 'bag', t: `${ZONE_NAMES[z]} trop plein`, s: `+${formatLitres(v - cap)} au-delà de sa capacité.` });
  }
  return out;
}

/** maquette l.901 : « Prêt à N % » = 100 - 13 par blocage - 7 si déséquilibré, borné à 0..100. */
export function readiness(bl: readonly Blocker[], cs: Pick<CogState, 'ok'>): number {
  return Math.max(0, Math.min(100, 100 - 13 * bl.length - (cs.ok ? 0 : 7)));
}

/** maquette l.1389-1393 (readyHTML) : points gagnés si le blocage est levé (13 par blocage, 7 pour l'équilibre). */
export function readinessGain(s: KitState, b: Pick<Blocker, 'kind' | 'id' | 't'>): number {
  const bl = blockers(s);
  const cs = cogState(cog(s));
  const now = readiness(bl, cs);
  if (b.kind === 'cog') return readiness(bl, { ok: true }) - now;
  const at = bl.findIndex((x) => x.kind === b.kind && x.t === b.t && x.id === b.id);
  if (at < 0) return 0;
  return readiness(bl.filter((_, i) => i !== at), cs) - now;
}

const ACCESS_FN: readonly string[] = ['rainshell', 'light', 'map', 'snack', 'sunscreen', 'firstaid', 'insulation'];
const NO_DUP_FN: readonly string[] = ['water', 'food', 'snack', 'clothes', 'fuel'];

/** maquette l.903-905 : conseils (objet utile en marchant rangé au fond, objets redondants). */
export function tips(s: KitState): Tip[] {
  const out: Tip[] = [];
  const idx = reindex(s);
  for (const id of packedIds(s, 'main')) {
    const it = getItem(s, id);
    const x = idx[id];
    if (it && ACCESS_FN.includes(it.fn) && x && x.slot !== 'top') {
      out.push({ t: `${it.n} au fond du sac`, s: 'Sert en marchant : à mettre en haut ou dans le couvercle.', id });
    }
  }
  const by: Record<string, { n: string; id: string; g: number }[]> = {};
  for (const z of PACK_ZONE_IDS) {
    if (z === 'worn') continue;
    for (const id of packedIds(s, z)) {
      const it = getItem(s, id);
      if (!it || NO_DUP_FN.includes(it.fn)) continue;
      (by[it.fn] ??= []).push({ n: it.n, id: it.id, g: effG(s, it) });
    }
  }
  for (const a of Object.values(by)) {
    if (a.length > 1) {
      const g = Math.min(...a.map((x) => x.g));
      out.push({ t: `${a.length} objets pour le même usage`, s: `${a.map((x) => x.n).join(', ')}. ${g === 0 ? '+' : '−'}${formatWeight(g)} possible.`, id: a[0].id });
    }
  }
  return out;
}
