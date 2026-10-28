/**
 * Compas v5 · tiroir « Sac » : modèle de vue PUR (aucune lecture réseau, aucun texte d'interface).
 *
 * Tout vient du moteur existant (`buildCompasModel` : lignes du kit, équipage ; `adviseKit` : conseils ;
 * `planKitApply` / `kitCompatibility` : kits de la personne). Rien n'est inventé : un poids inconnu est
 * dit inconnu (jamais compté zéro), un objet sans photo de catalogue n'a pas de photo.
 */
import type { CompasKitLine, CompasMemberLoad, CompasModel } from '../../engine/compasModel';
import type { KitAdvice } from '../../engine/kitRules';
import { normalizeName, planKitApply, type KitApplyPlan, type MyKit } from '../../engine/kitApply';
import { bestShopProduct, productFitsLine } from '../../engine/shopMatch';
import type { CompasShopProduct } from '../../server/getCompasData';
import type { V5IconName } from '../ui/icons';

/* ---------- Catégories de poids ---------- */

export type WeightGroup = 'porter' | 'dormir' | 'vetements' | 'securite' | 'eau' | 'autre';

/** Ordre d'affichage (anneau, légende, liste d'objets). */
export const WEIGHT_GROUPS: readonly WeightGroup[] = ['porter', 'dormir', 'vetements', 'securite', 'eau', 'autre'];

const plain = (value: string | null | undefined) => normalizeName(value ?? '');

/** Motifs testés d'abord sur la catégorie enregistrée, puis sur le nom. L'ordre compte (le plus précis d'abord). */
const GROUP_PATTERNS: ReadonlyArray<[WeightGroup, RegExp]> = [
  ['securite', /secu|safety|secours|pharma|trousse|frontale|lampe|survie|sifflet|balise|boussole|carte |gps|navigation/],
  ['dormir', /dorm|sleep|shelter|abri|tente|tarp|duvet|matelas|couchage|drap|hamac|bivy|oreiller/],
  ['vetements', /vet|cloth|veste|pantalon|polaire|doudoune|chaussette|chaussure|gant|bonnet|chapeau|casquette|short|t-shirt|maillot|imper/],
  ['eau', /\beau\b|water|gourde|filtre|cook|cuisine|rechaud|popote|repas|food|nourriture|gamelle|gaz/],
  ['porter', /porter|portage|backpack|sac a dos|baton|\bsac\b/],
];

/** Groupe d'un objet : par sa catégorie enregistrée, à défaut par son nom, sinon « autre ». */
export function weightGroup(category: string | null, name = ''): WeightGroup {
  const cat = plain(category);
  if (cat) for (const [group, re] of GROUP_PATTERNS) if (re.test(cat)) return group;
  const nm = ` ${plain(name)} `;
  for (const [group, re] of GROUP_PATTERNS) if (re.test(nm)) return group;
  return 'autre';
}

/** Illustration sobre d'un objet sans photo de catalogue (jamais la photo d'un autre objet). */
export function itemIcon(line: Pick<CompasKitLine, 'name' | 'category'>): V5IconName {
  const name = plain(line.name);
  if (/baton|pole/.test(name)) return 'marche';
  if (/veste|doudoune|jacket|manteau/.test(name)) return 'vetement';
  if (/polaire|pull|shirt|pantalon|short/.test(name)) return 'vetement';
  if (/drap/.test(name)) return 'couchage';
  if (/tente|tarp|abri|bivy/.test(name)) return 'tente';
  if (/rechaud|popote|gamelle/.test(name)) return 'rechaud';
  if (/gourde|eau|filtre|bouteille/.test(name)) return 'eau_potable';
  if (/trousse|secours|pharma/.test(name)) return 'trousse';
  if (/carte|boussole|gps/.test(name)) return 'carte';
  if (/frontale|lampe/.test(name)) return 'soleil';
  switch (weightGroup(line.category, line.name)) {
    case 'porter':
      return 'sac';
    case 'dormir':
      return 'tente';
    case 'vetements':
      return 'vetement';
    case 'securite':
      return 'trousse';
    case 'eau':
      return 'eau_potable';
    default:
      return 'inventaire';
  }
}

/* ---------- Ce que la personne porte ---------- */

/**
 * Les lignes du sac de la personne, comme le moteur les compte (`carriedGrams`) : ni le porté sur soi, ni
 * l'affaire personnelle d'un autre membre ; le matériel commun seulement s'il lui est confié.
 */
export function myLines(lines: readonly CompasKitLine[], viewerId: string | null, memberIds: ReadonlySet<string>): CompasKitLine[] {
  return lines.filter((line) => {
    if (line.kind === 'worn') return false;
    if (line.shared) return viewerId != null && line.ownerId === viewerId;
    const owner = line.ownerId && memberIds.has(line.ownerId) ? line.ownerId : null;
    return owner == null || owner === viewerId;
  });
}

export const lineWeightG = (line: Pick<CompasKitLine, 'weightGrams' | 'quantity'>): number | null =>
  line.weightGrams == null ? null : line.weightGrams * Math.max(1, line.quantity);

export interface WeightSegment {
  group: WeightGroup;
  grams: number;
  /** Part de l'anneau, 0 à 1 (échelle : la capacité si elle est connue, sinon le poids total). */
  share: number;
}

export interface WeightRing {
  totalG: number;
  /** Objets dont le poids n'est pas renseigné : dits, jamais comptés zéro. */
  unknownWeightCount: number;
  segments: WeightSegment[];
  capacityG: number | null;
  scaleG: number;
  over: boolean;
}

/** Anneau de poids par catégorie. `capacityKg` : la capacité de la personne, ou null si elle est inconnue. */
export function weightRing(lines: readonly CompasKitLine[], capacityKg: number | null): WeightRing {
  const grams = new Map<WeightGroup, number>();
  let unknown = 0;
  for (const line of lines) {
    const g = lineWeightG(line);
    if (g == null) {
      unknown += 1;
      continue;
    }
    const group = weightGroup(line.category, line.name);
    grams.set(group, (grams.get(group) ?? 0) + g);
  }
  const total = [...grams.values()].reduce((a, b) => a + b, 0);
  const capacityG = capacityKg != null && capacityKg > 0 ? Math.round(capacityKg * 1000) : null;
  const scale = capacityG ?? total;
  const segments = WEIGHT_GROUPS.filter((g) => (grams.get(g) ?? 0) > 0).map((group) => ({
    group,
    grams: grams.get(group) as number,
    share: scale > 0 ? Math.min(1, (grams.get(group) as number) / scale) : 0,
  }));
  return { totalG: total, unknownWeightCount: unknown, segments, capacityG, scaleG: scale, over: capacityG != null && total > capacityG };
}

/** Capacité de la personne : sa fiche de membre, sinon le poids max choisi pour le voyage. */
export function viewerCapacityKg(model: CompasModel, viewerId: string | null): number | null {
  const load = viewerId ? model.crew.loads.find((l) => l.userId === viewerId) : undefined;
  return load?.capacityKg ?? model.preferences.maxPackKg ?? null;
}

/* ---------- État d'un objet ---------- */

export type ItemState = 'have' | 'buy' | 'borrow' | 'lent' | 'replace';
export type BuyStage = 'needed' | 'in_cart' | 'shipping';

/**
 * État lu sur les données existantes :
 * - « prêté » : l'objet de l'inventaire est en prêt ;
 * - « Je l'ai » : inventaire, emballé, ou déclaré (`purchase_state = 'added'`, comme à la création d'un kit) ;
 * - « à emprunter » : confié à quelqu'un d'autre du groupe (le geste de « Emprunter ») ;
 * - sinon « à acheter » (ou « à remplacer » si l'état de l'objet le dit).
 */
export function itemState(line: CompasKitLine, viewerId: string | null): ItemState {
  if (line.status === 'lent') return 'lent';
  if (line.purchaseState === 'added') return 'have';
  if (line.status === 'replace') return 'replace';
  if (line.status === 'owned') return 'have';
  if (line.shared && line.ownerId && line.ownerId !== viewerId) return 'borrow';
  return 'buy';
}

/** L'état peut-il être changé d'ici ? Non quand l'objet est déjà dans l'inventaire ou emballé (la donnée est ailleurs). */
export function stateEditable(line: CompasKitLine): boolean {
  if (line.status === 'lent') return false;
  return !(line.status === 'owned' && line.purchaseState !== 'added');
}

export function buyStage(line: CompasKitLine): BuyStage {
  return line.purchaseState === 'in_cart' ? 'in_cart' : line.purchaseState === 'shipping' ? 'shipping' : 'needed';
}

/** L'état d'achat à rétablir pour annuler un geste (`setPurchaseStateAction` n'écrit que ces quatre valeurs). */
export function restorablePurchaseState(line: Pick<CompasKitLine, 'purchaseState'>): 'needed' | 'added' | 'in_cart' | 'shipping' {
  const s = line.purchaseState;
  return s === 'added' || s === 'in_cart' || s === 'shipping' ? s : 'needed';
}

/**
 * Le produit de la boutique de cet objet : celui déjà choisi (si son titre ne contredit pas l'objet), sinon le
 * plus pertinent du catalogue. Jamais un produit inventé.
 */
export function shopProductFor(line: CompasKitLine, shop: readonly CompasShopProduct[]): { product: CompasShopProduct; linked: boolean } | null {
  const linked = line.shopProductId ? shop.find((p) => p.id === line.shopProductId) : undefined;
  if (linked && productFitsLine(line, linked)) return { product: linked, linked: true };
  const best = bestShopProduct(line, shop);
  return best ? { product: best, linked: false } : null;
}

/** La photo d'un objet : celle de son produit lié au catalogue, ou rien. */
export function itemPhoto(line: CompasKitLine, shop: readonly CompasShopProduct[]): { src: string; alt: string } | null {
  const linked = line.shopProductId ? shop.find((p) => p.id === line.shopProductId) : undefined;
  if (!linked || !linked.image || !productFitsLine(line, linked)) return null;
  return { src: linked.image, alt: linked.imageAlt || line.name };
}

/* ---------- Adaptations expliquées ---------- */

export interface AddedAdaptation {
  kind: 'added';
  lineId: string;
  name: string;
  reason: string;
  weightG: number | null;
  vital: boolean;
}
export interface AdviceAdaptation {
  kind: 'advice';
  adviceId: string;
  label: string;
  reason: string;
  source: string;
}

export interface Adaptations {
  /** Objets du sac qui ont une raison de présence (météo, parcours, nuit…). */
  added: AddedAdaptation[];
  /** Conseils du parcours que rien dans le sac ne couvre encore. */
  advice: AdviceAdaptation[];
  coveredAdvice: number;
  totalAdvice: number;
  /** Poids des objets ajoutés pour une raison, et combien n'ont pas de poids renseigné. */
  addedWeightG: number;
  addedUnknownWeight: number;
}

export function adaptations(lines: readonly CompasKitLine[], advice: readonly KitAdvice[]): Adaptations {
  const added = lines
    .filter((l) => (l.reason ?? '').trim().length > 0)
    .map<AddedAdaptation>((l) => ({ kind: 'added', lineId: l.id, name: l.name, reason: (l.reason ?? '').trim(), weightG: lineWeightG(l), vital: l.vital }))
    .sort((a, b) => Number(b.vital) - Number(a.vital));
  const open = advice
    .filter((a) => !a.covered)
    .map<AdviceAdaptation>((a) => ({ kind: 'advice', adviceId: a.id, label: a.label, reason: a.reason, source: a.source }));
  return {
    added,
    advice: open,
    coveredAdvice: advice.filter((a) => a.covered).length,
    totalAdvice: advice.length,
    addedWeightG: added.reduce((sum, a) => sum + (a.weightG ?? 0), 0),
    addedUnknownWeight: added.filter((a) => a.weightG == null).length,
  };
}

/* ---------- Regroupement des objets ---------- */

export interface LineGroup {
  group: WeightGroup;
  lines: CompasKitLine[];
}

/** Objets rangés par catégorie, dans l'ordre de l'anneau ; les vitaux d'abord dans chaque catégorie. */
export function groupLines(lines: readonly CompasKitLine[]): LineGroup[] {
  const buckets = new Map<WeightGroup, CompasKitLine[]>();
  for (const line of lines) {
    const g = weightGroup(line.category, line.name);
    const list = buckets.get(g) ?? [];
    list.push(line);
    buckets.set(g, list);
  }
  return WEIGHT_GROUPS.filter((g) => buckets.has(g)).map((group) => ({
    group,
    lines: [...(buckets.get(group) as CompasKitLine[])].sort((a, b) => Number(b.vital) - Number(a.vital)),
  }));
}

/* ---------- Mes kits ---------- */

export interface KitSummary {
  itemCount: number;
  knownWeightG: number;
  unknownWeightCount: number;
  plan: KitApplyPlan;
}

/** Résumé d'un kit de la personne : combien d'objets, quel poids connu, ce que l'appliquer ajouterait. */
export function kitSummary(kit: MyKit, tripNames: readonly string[]): KitSummary {
  const plan = planKitApply(kit, [...tripNames]);
  let known = 0;
  let unknown = 0;
  for (const item of kit.items) {
    if (item.weightG == null) unknown += 1;
    else known += item.weightG * Math.max(1, item.quantity);
  }
  return { itemCount: kit.items.length, knownWeightG: known, unknownWeightCount: unknown, plan };
}

/* ---------- Qui porte quoi ---------- */

export interface CarryMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  carriedG: number;
  capacityKg: number | null;
  ratio: number | null;
  shared: Array<{ id: string; name: string; weightG: number | null }>;
}

export interface CarryView {
  members: CarryMember[];
  /** Matériel commun sans porteur. */
  unassigned: CompasKitLine[];
  sharedCount: number;
}

export function carryView(model: CompasModel, lines: readonly CompasKitLine[]): CarryView {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const members = model.crew.loads.map<CarryMember>((m: CompasMemberLoad) => ({
    userId: m.userId,
    name: m.name,
    avatarUrl: m.avatarUrl,
    carriedG: m.carriedGrams,
    capacityKg: m.capacityKg,
    ratio: m.ratio,
    shared: m.sharedItemIds
      .map((id) => byId.get(id))
      .filter((l): l is CompasKitLine => l != null)
      .map((l) => ({ id: l.id, name: l.name, weightG: lineWeightG(l) })),
  }));
  return {
    members,
    unassigned: model.crew.unassignedShared,
    sharedCount: lines.filter((l) => l.shared && l.kind !== 'worn').length,
  };
}
