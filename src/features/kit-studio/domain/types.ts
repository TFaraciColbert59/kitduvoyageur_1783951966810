// Contrat d'état du Kit Studio (coordinateur). Le domaine est pur : chaque fonction reçoit
// l'état et renvoie une valeur ou un NOUVEL état (jamais de mutation de l'argument).
// Correspondance maquette : kit() → state.kits[state.kitId], cfg() → state.config[kit.bag],
// S.day → state.day, OWN/ORDER → state.own/state.order, INV + objets ajoutés → itemsOf(state).
import type {
  AccessoryId, BagId, ColorwayId, ConfigSet, Item, ItemId, Kit, KitId, ModuleId, PackZoneId,
} from './catalog';

/** Clé de pièce : 'chassis' | `corps:${BagId}` | `mod:${ModuleId}` (maquette l.710 v2). */
export type PieceKey = 'chassis' | `corps:${BagId}` | `mod:${ModuleId}`;

/** Objet hors catalogue ajouté par l'utilisateur (achat/location prévus, maquette addPlanned). */
export type ExtraItem = Omit<Item, 'id'> & {
  readonly id: string;
  readonly planned?: 'shop' | 'rent';
  /** Prix d'achat (€) ou de location par jour (€/j), maquette ALT / addPlanned. */
  readonly eur?: number;
  readonly day?: number;
};

export type AnyItemId = ItemId | string;

/** Kit vivant : copie modifiable d'un Kit du catalogue (maquette KS = clone de KITS). */
export interface LiveKit extends Omit<Kit, 'packed' | 'slots' | 'bag' | 'cw'> {
  readonly bag: BagId;
  readonly cw: ColorwayId;
  /** Contenu par zone, dans l'ordre de rangement. */
  readonly packed: Readonly<Record<PackZoneId, readonly AnyItemId[]>>;
  /** Placement fin dans le compartiment principal (null = automatique). */
  readonly slots: Readonly<Record<string, string>> | null;
}

export interface KitState {
  readonly version: 1;
  readonly kitId: KitId;
  readonly kits: Readonly<Record<KitId, LiveKit>>;
  /** Configuration d'apparence par corps de sac (maquette CFG). */
  readonly config: Readonly<Record<BagId, ConfigSet>>;
  /** Jour affiché dans le Bilan (1..kit.days). */
  readonly day: number;
  /** Pièces possédées et commandées : clé → coloris (maquette OWN / ORDER, l.713-714 v2). */
  readonly own: Readonly<Partial<Record<PieceKey, ColorwayId>>>;
  readonly order: Readonly<Partial<Record<PieceKey, ColorwayId>>>;
  /** Objets hors catalogue (achats, locations). */
  readonly extraItems: readonly ExtraItem[];
}

export type { AccessoryId, ModuleId };
