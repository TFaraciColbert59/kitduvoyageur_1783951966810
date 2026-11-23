/**
 * Le vrai sac (9.1) : les objets viennent du kit du voyage (`trip_items`), pas d'un inventaire propre à la page.
 * Pur. Un objet du voyage devient un `CollaborativeKitItem` d'identifiant stable (`trip-item-<id>`) : importer deux
 * fois le même sac ne crée rien en double, et une attribution ou une confirmation déjà faite dans l'itinéraire
 * n'est jamais écrasée.
 *
 * `dependsOn` (ce qui fait revérifier un objet quand le tracé change, 9.2) est lu sur le NOM de l'objet et sa
 * catégorie par une table de mots, sans IA. Un objet dont le nom n'est reconnu par aucune règle n'a aucune
 * dépendance : il n'est jamais marqué « à revérifier » à tort, et le tiroir le dit (« jamais revérifié »).
 */
import type { CollaborativeKitItem, RouteMemberAccess } from '../types';

export const TRIP_ITEM_PREFIX = 'trip-item-';

export interface TripItemRow {
  readonly id: string;
  readonly item_name: string;
  readonly category: string | null;
  readonly quantity: number | null;
  readonly weight_grams: number | null;
  readonly ownership?: 'personal' | 'shared' | null;
  readonly owner_id?: string | null;
  readonly inventory_item_id?: string | null;
}

type Dep = CollaborativeKitItem['dependsOn'][number];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mots (sans accent) qui rattachent un objet à ce qui peut changer dans l'itinéraire. */
export const DEPENDENCY_WORDS: Readonly<Record<Dep, readonly string[]>> = {
  overnight: ['tente', 'abri', 'bivouac', 'tarp', 'hamac', 'couchage', 'matelas', 'duvet', 'rechaud', 'popote', 'cartouche', 'gaz', 'rechaud'],
  water: ['filtre', 'gourde', 'poche a eau', 'pastille', 'purific', 'bouteille'],
  weather: ['veste', 'impermeable', 'poncho', 'pluie', 'gore', 'doudoune', 'gants', 'bonnet', 'solaire', 'lunettes', 'surpantalon'],
  duration: ['nourriture', 'repas', 'barre', 'ration', 'lyophil', 'batterie', 'powerbank'],
  distance: [],
};

const CATEGORY_DEP: Readonly<Record<string, Dep>> = { abri: 'overnight', couchage: 'overnight', cuisine: 'overnight', hydratation: 'water', eau: 'water', nourriture: 'duration' };

export function inferDependsOn(name: string, category: string | null): Dep[] {
  const n = norm(name);
  const out = new Set<Dep>();
  for (const dep of Object.keys(DEPENDENCY_WORDS) as Dep[]) {
    if (DEPENDENCY_WORDS[dep].some((w) => n.includes(w))) out.add(dep);
  }
  const c = category ? CATEGORY_DEP[norm(category)] : undefined;
  if (c) out.add(c);
  return [...out];
}

export function tripItemToKitItem(row: TripItemRow, members: readonly Pick<RouteMemberAccess, 'userId' | 'displayName'>[]): CollaborativeKitItem {
  const shared = row.ownership === 'shared';
  const owner = row.owner_id ? members.find((m) => m.userId === row.owner_id) : undefined;
  const assigneeUserId = owner ? owner.userId : null;
  return {
    id: `${TRIP_ITEM_PREFIX}${row.id}`,
    inventoryItemId: row.inventory_item_id ?? null,
    name: row.item_name.slice(0, 160),
    category: row.category ?? 'divers',
    weightGrams: row.weight_grams != null && row.weight_grams >= 0 ? row.weight_grams : null,
    quantity: Math.max(1, Math.floor(row.quantity ?? 1)),
    shared,
    assigneeUserId,
    assigneeName: owner?.displayName ?? null,
    dependsOn: inferDependsOn(row.item_name, row.category),
    status: assigneeUserId ? 'confirmed' : 'unassigned',
  };
}

export interface TripKitMerge {
  readonly items: readonly CollaborativeKitItem[];
  /** Objets du voyage ajoutés à l'itinéraire cette fois. */
  readonly added: readonly CollaborativeKitItem[];
  /** Objets déjà présents, mis à jour (nom, poids, quantité). */
  readonly refreshed: number;
  /** Objets importés plus tôt, retirés depuis du sac du voyage : gardés, signalés. */
  readonly orphanIds: readonly string[];
  /** Objets sans aucune dépendance reconnue : jamais revérifiés. */
  readonly neverRechecked: number;
}

export function mergeTripKit(
  existing: readonly CollaborativeKitItem[],
  rows: readonly TripItemRow[],
  members: readonly Pick<RouteMemberAccess, 'userId' | 'displayName'>[],
): TripKitMerge {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const added: CollaborativeKitItem[] = [];
  let refreshed = 0;
  const seen = new Set<string>();
  const items = existing.slice() as CollaborativeKitItem[];
  for (const row of rows) {
    const next = tripItemToKitItem(row, members);
    seen.add(next.id);
    const have = byId.get(next.id);
    if (!have) {
      added.push(next);
      items.push(next);
      continue;
    }
    // L'attribution et la confirmation faites ici gagnent ; nom, poids et quantité suivent le sac du voyage.
    const merged: CollaborativeKitItem = {
      ...have,
      name: next.name,
      category: next.category,
      weightGrams: next.weightGrams,
      quantity: next.quantity,
      shared: next.shared,
      inventoryItemId: next.inventoryItemId,
      dependsOn: next.dependsOn,
      ...(have.assigneeUserId ? {} : { assigneeUserId: next.assigneeUserId, assigneeName: next.assigneeName, status: have.status === 'needs_revalidation' ? have.status : next.status }),
    };
    if (JSON.stringify(merged) !== JSON.stringify(have)) refreshed += 1;
    items[items.indexOf(have)] = merged;
  }
  const orphanIds = existing.filter((i) => i.id.startsWith(TRIP_ITEM_PREFIX) && !seen.has(i.id)).map((i) => i.id);
  return { items, added, refreshed, orphanIds, neverRechecked: items.filter((i) => i.dependsOn.length === 0).length };
}
